import type { GenerateContentResponse } from "@google/genai";
import { geminiClient } from "./client";
import {
  confirmTranslatePrompt,
  modifyPrompt,
  plainifyPrompt,
  translatePrompt,
  zhPrompt,
} from "./prompts";
import type { Reference } from "../session/types";

const MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 5000;

export interface TextResult {
  text: string;
  references: Reference[];
}

async function callText(
  userText: string,
  systemPrompt: string,
  opts: { temperature?: number; useSearch?: boolean } = {},
): Promise<TextResult> {
  const client = geminiClient();
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: userText }] }],
    config: {
      temperature: opts.temperature ?? 0.25,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "text/plain",
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: opts.useSearch ? [{ googleSearch: {} }] : undefined,
    },
  });

  return {
    text: extractText(response),
    references: extractReferences(response),
  };
}

function extractText(response: GenerateContentResponse): string {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text ?? "").join("").trim();
}

function extractReferences(response: GenerateContentResponse): Reference[] {
  const grounding = response.candidates?.[0]?.groundingMetadata;
  const rendered = grounding?.searchEntryPoint?.renderedContent;
  if (!rendered) return [];

  const refs: Reference[] = [];
  const re = /<a[^>]*class="chip"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rendered)) !== null) {
    const url = m[1];
    const title = m[2].trim();
    if (url && title) refs.push({ title, url });
  }
  return refs;
}

export function callZh(topic: string): Promise<TextResult> {
  return callText(topic, zhPrompt, { temperature: 0.25, useSearch: true });
}

export function callModify(instruction: string, original: string): Promise<TextResult> {
  const prompt = `User instruction:\n${instruction}\n\nOriginal content:\n${original}`;
  return callText(prompt, modifyPrompt, { temperature: 0.25, useSearch: true });
}

export function callTranslate(zhText: string, lang: string): Promise<TextResult> {
  return callText(zhText, translatePrompt(lang), { temperature: 0.25, useSearch: true });
}

export async function plainify(text: string): Promise<string> {
  const res = await callText(
    `Please translate for the patient: ${text}`,
    plainifyPrompt,
    { temperature: 0.25 },
  );
  return res.text;
}

export async function confirmTranslate(plainZh: string, lang: string): Promise<string> {
  const res = await callText(
    `Please translate for the patient: ${plainZh}`,
    confirmTranslatePrompt(lang),
    { temperature: 0.2 },
  );
  return res.text;
}

export function mergeReferences(existing: Reference[], incoming: Reference[]): Reference[] {
  const seen = new Set(existing.map((r) => r.url));
  const out = [...existing];
  for (const r of incoming) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      out.push(r);
    }
  }
  return out;
}
