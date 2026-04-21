import { geminiClient } from "./client";
import { pcmToWav, estimateWavDurationMs } from "../audio/wav";
import { uploadAudio } from "../storage/blob";
import { sanitizeUserId, sanitizeFilename } from "../validators";
import { logTts } from "../logging";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const MAX_TTS_LENGTH = 5000;
const SAMPLE_RATE = 24000;

export interface TtsResult {
  url: string;
  durationMs: number;
}

export async function synthesize(
  text: string,
  userId: string,
  voiceName = "Kore",
): Promise<TtsResult> {
  if (!text || !text.trim()) throw new Error("Cannot synthesize empty text");

  const safeUserId = sanitizeUserId(userId);
  let content = text;
  if (content.length > MAX_TTS_LENGTH) {
    content = content.slice(0, MAX_TTS_LENGTH) + "...";
  }

  const client = geminiClient();
  const response = await client.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role: "user", parts: [{ text: content }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("TTS response has no inline audio data");

  const pcm = Buffer.from(inline.data, "base64");
  if (pcm.length === 0) throw new Error("TTS response contains empty audio data");

  const wav = pcmToWav(pcm, { sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16 });
  const durationMs = Math.round((pcm.length / 2 / SAMPLE_RATE) * 1000);

  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
  const filename = sanitizeFilename(`${safeUserId}_${ts}.wav`);
  const url = await uploadAudio(filename, wav, "audio/wav");

  void logTts({
    userId: safeUserId,
    text: content,
    audioFilename: filename,
    audioUrl: url,
  });

  return { url, durationMs };
}

export { estimateWavDurationMs };
