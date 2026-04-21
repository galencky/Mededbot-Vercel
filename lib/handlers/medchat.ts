import type { Session } from "../session/types";
import { plainify, confirmTranslate } from "../gemini/text";
import { translateToTaigi } from "../taigi/service";
import { normalizeLanguageInput } from "../language";
import { isTaigi } from "../constants/commands";
import {
  buildQuickReply,
  COMMON_LANGUAGES,
  CHAT_TTS_OPTIONS,
} from "../constants/quick-reply";
import { reply, type HandlerReply } from "./reply";
import { logChat } from "../logging";

function looksLikeLanguage(token: string): boolean {
  if (token.length < 1 || token.length > 15) return false;
  return Array.from(token).every(
    (ch) => /\p{L}/u.test(ch) || (ch >= "一" && ch <= "鿿"),
  );
}

export async function handleMedchat(
  userId: string,
  raw: string,
  session: Session,
): Promise<HandlerReply> {
  if (
    (raw.toLowerCase() === "繼續翻譯" || raw.toLowerCase() === "continue") &&
    session.chat_target_lang
  ) {
    delete session.tts_audio_url;
    delete session.tts_audio_dur;
    delete session.show_taigi_credit;
    delete session.zh_output;
    delete session.translated_output;
    return reply(
      `請輸入您想翻譯的內容（目標語言：${session.chat_target_lang}）：`,
    );
  }

  if (session.awaiting_chat_language) {
    if (!looksLikeLanguage(raw)) {
      return reply(
        "請先選擇或輸入您需要翻譯的目標語言：",
        false,
        buildQuickReply(COMMON_LANGUAGES),
      );
    }
    const normalized = normalizeLanguageInput(raw);
    session.chat_target_lang = normalized;
    session.awaiting_chat_language = false;
    session.started = true;
    session.mode = "chat";

    await logChat({
      userId,
      message: `[Language Selection: ${normalized}]`,
      reply: `目標語言已設定為「${normalized}」`,
      actionType: "sync reply",
      geminiCall: false,
    });

    return reply(
      `✅ 目標語言已設定為「${normalized}」。\n請輸入您想翻譯的內容（中文或其他語言皆可）： \n\n支援文字輸入及語音輸入`,
    );
  }

  if (!session.chat_target_lang) {
    session.awaiting_chat_language = true;
    session.started = true;
    session.mode = "chat";
    return reply(
      "尚未設定翻譯語言。請選擇或輸入您需要的目標語言：",
      false,
      buildQuickReply(COMMON_LANGUAGES),
    );
  }

  const plainZh = await plainify(raw);
  const targetLang = session.chat_target_lang;
  const taigi = isTaigi(targetLang);

  const translated = taigi
    ? await translateToTaigi(plainZh)
    : await confirmTranslate(plainZh, targetLang);

  session.zh_output = plainZh;
  session.translated_output = translated;
  session.last_translation_lang = targetLang;

  const replyText = `您是否想表達（${targetLang}）：\n${plainZh}\n\n${translated}`;

  await logChat({
    userId,
    message: raw,
    reply: replyText,
    actionType: "medchat",
    geminiCall: !taigi,
  });

  return reply(replyText, !taigi, buildQuickReply(CHAT_TTS_OPTIONS));
}
