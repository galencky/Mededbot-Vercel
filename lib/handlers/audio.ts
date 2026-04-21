import type { AudioEventMessage, MessageEvent } from "@line/bot-sdk";
import type { Session } from "../session/types";
import { getMessageContentBuffer } from "../line/client";
import { transcribeAudio } from "../gemini/stt";
import { handleMedchat } from "./medchat";
import {
  buildQuickReply,
  COMMON_LANGUAGES,
  MODE_SELECTION_OPTIONS,
  START_OPTIONS,
} from "../constants/quick-reply";
import { reply, type HandlerReply } from "./reply";
import { logVoicemail } from "../logging";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function handleAudioMessage(
  event: MessageEvent & { message: AudioEventMessage },
  session: Session,
): Promise<HandlerReply> {
  const userId = event.source.userId;
  if (!userId) {
    return reply("無法識別使用者身分，請稍後再試。");
  }

  if (session.mode !== "chat" || !session.chat_target_lang) {
    return audioRejection(session);
  }

  try {
    const buffer = await getMessageContentBuffer(event.message.id);
    if (buffer.length > MAX_AUDIO_BYTES) {
      return reply("語音檔過大，請錄製較短的訊息後再試。");
    }

    const transcription = (await transcribeAudio(buffer, "audio/m4a")).trim();
    if (!transcription) return reply("無法辨識語音內容，請再試一次。");

    const result = await handleMedchat(userId, transcription, session);

    void logVoicemail({
      userId,
      audioFilename: `${userId}-${Date.now()}.m4a`,
      transcription,
      translation: session.translated_output ?? "",
    });

    const combined = `🎤 語音訊息：\n${transcription}\n\n${result.text}`;
    return reply(combined, result.geminiCalled, result.quickReply);
  } catch (err) {
    console.error("[AUDIO] handler error:", err);
    return reply("語音處理失敗。");
  }
}

function audioRejection(session: Session): HandlerReply {
  if (!session.started) {
    return reply(
      "請先點擊【開始】選擇功能：",
      false,
      buildQuickReply(START_OPTIONS),
    );
  }
  if (session.mode === "edu") {
    return reply(
      "衛教模式不支援語音功能。請切換至醫療翻譯模式：",
      false,
      buildQuickReply([["🆕 新對話", "new"]]),
    );
  }
  if (session.mode === "chat" && session.awaiting_chat_language) {
    return reply(
      "請先選擇翻譯語言後，才能使用語音功能：",
      false,
      buildQuickReply(COMMON_LANGUAGES),
    );
  }
  return reply(
    "語音功能僅在醫療翻譯模式中可用。請先選擇功能：",
    false,
    buildQuickReply(MODE_SELECTION_OPTIONS),
  );
}
