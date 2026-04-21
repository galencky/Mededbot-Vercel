import { geminiClient } from "./client";
import { sttPrompt } from "./prompts";

const MODEL = "gemini-2.5-flash";

export async function transcribeAudio(
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  const client = geminiClient();
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: sttPrompt },
          { inlineData: { mimeType, data: audio.toString("base64") } },
        ],
      },
    ],
    config: {
      responseMimeType: "text/plain",
      temperature: 0.0,
    },
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  return text ?? "";
}

export function audioMimeFromExtension(ext: string): string {
  const map: Record<string, string> = {
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp3: "audio/mp3",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aiff: "audio/aiff",
  };
  return map[ext.toLowerCase()] ?? "audio/mp3";
}
