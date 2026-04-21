import { Client, validateSignature } from "@line/bot-sdk";
import type { Message as LineMessage } from "@line/bot-sdk";
import { env } from "../env";

let _client: Client | null = null;

export function lineClient(): Client {
  if (!_client) {
    _client = new Client({
      channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: env.LINE_CHANNEL_SECRET,
    });
  }
  return _client;
}

export function verifyLineSignature(body: string, signature: string): boolean {
  if (!signature) return false;
  try {
    return validateSignature(body, env.LINE_CHANNEL_SECRET, signature);
  } catch {
    return false;
  }
}

export async function replyMessage(
  replyToken: string,
  messages: LineMessage | LineMessage[],
): Promise<void> {
  try {
    await lineClient().replyMessage(replyToken, messages);
  } catch (err) {
    console.error("[LINE] replyMessage failed:", err);
    throw err;
  }
}

export async function getMessageContentBuffer(messageId: string): Promise<Buffer> {
  const stream = await lineClient().getMessageContent(messageId);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
