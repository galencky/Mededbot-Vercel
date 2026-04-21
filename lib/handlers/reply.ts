import type { QuickReply } from "@line/bot-sdk";

export interface HandlerReply {
  text: string;
  geminiCalled: boolean;
  quickReply?: QuickReply;
}

export function reply(text: string, geminiCalled = false, quickReply?: QuickReply): HandlerReply {
  return { text, geminiCalled, quickReply };
}
