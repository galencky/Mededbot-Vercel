import type {
  Message as LineMessage,
  TextMessage,
  AudioMessage,
  FlexMessage,
  FlexContainer,
  QuickReply,
} from "@line/bot-sdk";
import type { Reference } from "../session/types";
import {
  MAX_BUBBLE_COUNT,
  MAX_TOTAL_CHARS,
  MAX_CHARS_PER_BUBBLE,
  TRUNCATION_NOTICE,
} from "./limits";

export function textMessage(text: string, quickReply?: QuickReply): TextMessage {
  return quickReply
    ? { type: "text", text, quickReply }
    : { type: "text", text };
}

export function audioMessage(url: string, durationMs: number): AudioMessage {
  return {
    type: "audio",
    originalContentUrl: url,
    duration: Math.max(1, durationMs),
  };
}

export function referencesFlex(refs: Reference[]): FlexMessage | null {
  if (!refs.length) return null;
  const contents: FlexContainer = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "參考來源", weight: "bold", size: "lg", margin: "md" },
        ...refs.slice(0, 10).map((r) => ({
          type: "text" as const,
          text: r.title,
          size: "md" as const,
          color: "#3366CC",
          margin: "md" as const,
          wrap: true,
          action: { type: "uri" as const, label: r.title.slice(0, 40), uri: r.url },
        })),
      ],
    },
  };
  return { type: "flex", altText: "參考來源", contents };
}

export function taigiCreditFlex(): FlexMessage {
  const contents: FlexContainer = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "台語語音技術提供",
          weight: "bold",
          size: "md",
          margin: "md",
        },
        {
          type: "text",
          text: "NYCU iVoice Taiwanese TTS",
          size: "sm",
          color: "#888888",
          margin: "sm",
          wrap: true,
        },
        {
          type: "text",
          text: "tts001.ivoice.tw",
          size: "xs",
          color: "#3366CC",
          margin: "sm",
          action: {
            type: "uri",
            label: "NYCU iVoice",
            uri: "http://tts001.ivoice.tw:8804/",
          },
        },
      ],
    },
  };
  return { type: "flex", altText: "台語語音技術提供", contents };
}

export function truncateForLine(text: string): string {
  if (text.length <= MAX_CHARS_PER_BUBBLE) return text;
  return text.slice(0, MAX_CHARS_PER_BUBBLE - 50) + TRUNCATION_NOTICE;
}

export function bubbleChars(m: LineMessage): number {
  if (m.type === "text") return m.text.length;
  if (m.type === "flex") return (m.altText?.length ?? 0) * 10;
  return 0;
}

export function enforceLineLimits(messages: LineMessage[]): LineMessage[] {
  if (messages.length <= MAX_BUBBLE_COUNT) {
    const total = messages.reduce((n, m) => n + bubbleChars(m), 0);
    if (total <= MAX_TOTAL_CHARS) return messages;
  }

  const main = messages[messages.length - 1];
  const extras = messages.slice(0, -1);
  const kept: LineMessage[] = [];
  let chars = bubbleChars(main);
  let truncated = false;

  for (const m of extras) {
    const c = bubbleChars(m);
    if (kept.length + 1 < MAX_BUBBLE_COUNT - 1 && chars + c < MAX_TOTAL_CHARS) {
      kept.push(m);
      chars += c;
    } else {
      truncated = true;
      break;
    }
  }

  if (truncated && main.type === "text" && !main.text.includes(TRUNCATION_NOTICE.trim())) {
    (main as TextMessage).text = main.text + TRUNCATION_NOTICE;
  }
  kept.push(main);
  return kept;
}
