import type { Session } from "../session/types";
import {
  buildQuickReply,
  MODE_SELECTION_OPTIONS,
  COMMON_LANGUAGES,
  COMMON_DISEASES,
  CHAT_CONTINUE_OPTIONS,
  START_OPTIONS,
} from "../constants/quick-reply";
import {
  newCommands,
  eduCommands,
  chatCommands,
  speakCommands,
  isTaigi,
} from "../constants/commands";
import { handleEducationMode } from "./edu";
import { handleMedchat } from "./medchat";
import { synthesize } from "../gemini/tts";
import { synthesizeTaigi } from "../taigi/service";
import { reply, type HandlerReply } from "./reply";

export async function handleUserMessage(
  userId: string,
  text: string,
  session: Session,
): Promise<HandlerReply> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  session.user_id = userId;

  if (newCommands.has(lower)) return handleNew(session);

  if (session.started && speakCommands.has(lower)) {
    return handleSpeak(session, userId);
  }

  if (!session.started) {
    return reply(
      "歡迎使用 MedEdBot！請點擊【開始】按鈕開始使用：",
      false,
      buildQuickReply(START_OPTIONS),
    );
  }

  if (!session.mode) {
    if (eduCommands.has(lower)) {
      session.mode = "edu";
      return reply(
        "📚 進入衛教模式。請選擇或輸入您想了解的健康主題（如：糖尿病、高血壓等）：\n(AI 生成約需 20 秒，請耐心等候)",
        false,
        buildQuickReply(COMMON_DISEASES),
      );
    }
    if (chatCommands.has(lower)) {
      session.mode = "chat";
      session.awaiting_chat_language = true;
      return reply(
        "💬 進入對話模式。請選擇或輸入您需要的翻譯語言：",
        false,
        buildQuickReply(COMMON_LANGUAGES),
      );
    }
    return reply(
      "請選擇您需要的功能，或直接發送語音訊息：",
      false,
      buildQuickReply(MODE_SELECTION_OPTIONS),
    );
  }

  if (session.mode === "edu") {
    return handleEducationMode(session, trimmed, lower, userId);
  }
  if (session.mode === "chat") {
    return handleMedchat(userId, trimmed, session);
  }

  return reply(
    "抱歉，我不太理解您的意思。請點擊【開始】重新選擇功能，或直接發送語音訊息。",
    false,
    buildQuickReply(START_OPTIONS),
  );
}

function handleNew(session: Session): HandlerReply {
  for (const k of Object.keys(session)) delete (session as Record<string, unknown>)[k];
  session.started = true;
  return reply(
    "請選擇您需要的功能：",
    false,
    buildQuickReply(MODE_SELECTION_OPTIONS),
  );
}

async function handleSpeak(session: Session, userId: string): Promise<HandlerReply> {
  if (session.mode === "edu") {
    return reply(
      "衛教模式不支援語音朗讀功能。如需使用語音功能，請點擊【新對話】切換至醫療翻譯模式。",
      false,
      buildQuickReply([["🆕 新對話", "new"]]),
    );
  }

  if (session.tts_audio_url) {
    const qr =
      session.mode === "chat"
        ? buildQuickReply(CHAT_CONTINUE_OPTIONS)
        : buildQuickReply([["🆕 新對話", "new"]]);
    return reply("🔊 語音檔已存在", false, qr);
  }

  const ttsSource = session.translated_output;
  if (!ttsSource) {
    return reply("目前沒有可朗讀的翻譯內容。請先進行翻譯後再使用朗讀功能。");
  }

  try {
    const lang = session.last_translation_lang ?? session.chat_target_lang ?? "";
    if (isTaigi(lang)) {
      const zhSource = session.zh_output;
      if (!zhSource) return reply("無法找到原始中文內容進行台語語音合成。");
      const { url, durationMs } = await synthesizeTaigi(zhSource, userId);
      session.tts_audio_url = url;
      session.tts_audio_dur = durationMs;
      session.show_taigi_credit = true;
    } else {
      const { url, durationMs } = await synthesize(ttsSource, userId);
      session.tts_audio_url = url;
      session.tts_audio_dur = durationMs;
    }
    const qr =
      session.mode === "chat"
        ? buildQuickReply(CHAT_CONTINUE_OPTIONS)
        : buildQuickReply([["🆕 新對話", "new"]]);
    return reply("🔊 語音檔已生成", false, qr);
  } catch (err) {
    console.error("[TTS] synthesis error:", err);
    return reply("語音合成時發生錯誤，請稍後再試。");
  }
}
