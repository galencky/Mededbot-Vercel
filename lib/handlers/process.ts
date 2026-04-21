import type { WebhookEvent } from "@line/bot-sdk";
import { getSession, saveSession } from "../session/store";
import { handleUserMessage } from "./dispatcher";
import { handleAudioMessage } from "./audio";
import { buildResponseBubbles } from "./bubbles";
import { replyMessage } from "../line/client";
import { logChat } from "../logging";

export async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== "message") return;
  const userId = event.source.userId;
  if (!userId) return;

  const session = await getSession(userId);

  try {
    if (event.message.type === "text") {
      const text = event.message.text;
      const result = await handleUserMessage(userId, text, session);
      const bubbles = buildResponseBubbles(session, result);
      await replyMessage(event.replyToken, bubbles);
      await saveSession(userId, session);

      if (session.mode !== "chat") {
        await maybeLogChatEvent(userId, text, result.text, session, result.geminiCalled);
      }
      return;
    }

    if (event.message.type === "audio") {
      const result = await handleAudioMessage(
        event as Parameters<typeof handleAudioMessage>[0],
        session,
      );
      const bubbles = buildResponseBubbles(session, result);
      await replyMessage(event.replyToken, bubbles);
      await saveSession(userId, session);
      return;
    }
  } catch (err) {
    console.error("[PROCESS] event failed:", err);
    try {
      await replyMessage(event.replyToken, [
        { type: "text", text: "系統發生錯誤，請稍後再試。" },
      ]);
    } catch {
      // swallow
    }
  }
}

async function maybeLogChatEvent(
  userId: string,
  userInput: string,
  replyText: string,
  session: Parameters<typeof saveSession>[1],
  geminiCalled: boolean,
): Promise<void> {
  let loggedInput = userInput;
  let actionType: string = "sync reply";
  let url: string | null = null;

  if (session.awaiting_translate_language || session.awaiting_chat_language) {
    loggedInput = `[Language: ${userInput}] ${userInput}`;
  } else if (session.awaiting_email || session.email_r2_url) {
    loggedInput = `[Email to: ${userInput}]`;
    actionType = replyText.includes("成功寄出") ? "Email sent" : "Email failed";
    if (session.email_r2_url) {
      url = session.email_r2_url;
      delete session.email_r2_url;
    }
  }
  if (geminiCalled) actionType = "Gemini reply";

  await logChat({
    userId,
    message: loggedInput,
    reply: replyText.slice(0, 200),
    actionType,
    geminiCall: geminiCalled,
    geminiOutputUrl: url,
  });
}
