import type { Session } from "../session/types";
import {
  buildQuickReply,
  COMMON_DISEASES,
  EDU_ACTIONS,
  EDU_ACTIONS_NO_MODIFY,
  EDU_LANGUAGES,
} from "../constants/quick-reply";
import {
  modifyCommands,
  translateCommands,
  mailCommands,
  isTaigi,
} from "../constants/commands";
import { callZh, callModify, callTranslate, mergeReferences } from "../gemini/text";
import { validateEmail } from "../validators";
import { hasMxRecord } from "../email/service";
import { normalizeLanguageInput } from "../language";
import { sendEducationEmail } from "./email";
import { reply, type HandlerReply } from "./reply";

export async function handleEducationMode(
  session: Session,
  text: string,
  textLower: string,
  userId: string,
): Promise<HandlerReply> {
  if (session.awaiting_modify) return handleModify(session, text);
  if (session.awaiting_translate_language) return handleTranslate(session, text);
  if (session.awaiting_email) return handleEmail(session, text, userId);

  if (modifyCommands.has(textLower)) {
    if (!session.zh_output) {
      return reply("目前沒有衛教內容可供修改。請先輸入健康主題產生內容。");
    }
    session.awaiting_modify = true;
    return reply("✏️ 請描述您想如何修改內容：\n(AI 處理約需 20 秒，請耐心等候)");
  }

  if (translateCommands.has(textLower)) {
    if (!session.zh_output) {
      return reply("目前沒有衛教內容可供翻譯。請先輸入衛教主題產生內容。");
    }
    session.awaiting_translate_language = true;
    return reply(
      "🌐 請選擇或輸入任何您需要的翻譯語言：\n(AI 翻譯約需 20 秒，請耐心等候)",
      false,
      buildQuickReply(EDU_LANGUAGES),
    );
  }

  if (mailCommands.has(textLower)) {
    if (!session.zh_output) {
      return reply("目前沒有衛教內容可供寄送。請先輸入衛教主題產生內容。");
    }
    session.awaiting_email = true;
    return reply("📧 請輸入收件人的 email 地址（例如：example@gmail.com）：");
  }

  if (!session.zh_output) {
    const res = await callZh(text);
    session.zh_output = res.text;
    session.last_topic = text.slice(0, 30);
    delete session.translated_output;
    delete session.last_translation_lang;
    if (res.references.length) session.references = res.references;
    return reply(
      "✅ 中文版衛教內容已生成。",
      true,
      buildQuickReply(EDU_ACTIONS),
    );
  }

  return reply(
    "請選擇您想執行的操作，或直接輸入健康主題查詢新內容：",
    false,
    buildQuickReply([
      ["🆕 開始", "new"],
      ["✏️ 修改", "modify"],
      ["🌐 翻譯", "translate"],
      ["📧 寄送", "mail"],
    ]),
  );
}

async function handleModify(session: Session, instruction: string): Promise<HandlerReply> {
  const original = session.zh_output ?? "";
  const res = await callModify(instruction, original);
  session.zh_output = res.text;
  session.awaiting_modify = false;
  delete session.translated_output;
  delete session.last_translation_lang;
  if (res.references.length) {
    session.references = mergeReferences(session.references ?? [], res.references);
  }
  return reply("✅ 內容已根據您的要求修改。", true, buildQuickReply(EDU_ACTIONS));
}

async function handleTranslate(session: Session, language: string): Promise<HandlerReply> {
  const lang = normalizeLanguageInput(language);
  if (!lang || !lang.trim()) {
    return reply(
      "請輸入或選擇您需要的翻譯語言：",
      false,
      buildQuickReply(EDU_LANGUAGES),
    );
  }
  if (isTaigi(lang)) {
    return reply(
      "衛教模式不支援台語翻譯。請選擇其他語言，或使用醫療翻譯模式進行台語翻譯。",
      false,
      buildQuickReply(EDU_LANGUAGES),
    );
  }
  const res = await callTranslate(session.zh_output ?? "", lang);
  session.translated_output = res.text;
  session.translated = true;
  session.awaiting_translate_language = false;
  session.last_translation_lang = lang;
  session.just_translated = true;
  if (res.references.length) {
    session.references = mergeReferences(session.references ?? [], res.references);
  }
  return reply(
    `🌐 翻譯完成（目標語言：${lang}）。`,
    true,
    buildQuickReply(EDU_ACTIONS_NO_MODIFY),
  );
}

async function handleEmail(
  session: Session,
  email: string,
  userId: string,
): Promise<HandlerReply> {
  let validated: string;
  try {
    validated = validateEmail(email);
  } catch (e) {
    return reply(
      `輸入的 email 格式不正確：${(e as Error).message}\n請輸入有效的 email 地址（例如：name@gmail.com）。`,
    );
  }
  const domain = validated.split("@")[1];
  const mxOk = await hasMxRecord(domain);
  if (!mxOk) {
    return reply(
      `無法驗證 ${domain} 的郵件伺服器。請確認 email 地址是否正確（例如：name@gmail.com）。`,
    );
  }
  session.awaiting_email = false;
  const { success, artifactUrl } = await sendEducationEmail(userId, validated, session);
  if (artifactUrl) session.email_r2_url = artifactUrl;
  if (success) {
    return reply(
      `✅ 已成功寄出衛教內容至 ${validated}`,
      false,
      buildQuickReply(EDU_ACTIONS_NO_MODIFY),
    );
  }
  return reply("郵件寄送失敗。請檢查網路連線後再試一次。");
}
