import { getDb } from "./db/client";
import { chatLogs, ttsLogs, voicemailLogs } from "./db/schema";
import { sanitizeText, validateActionType } from "./validators";

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

export async function logChat(opts: {
  userId: string;
  message: string;
  reply: string;
  actionType: string;
  geminiCall: boolean;
  geminiOutputUrl?: string | null;
}): Promise<void> {
  try {
    await getDb().insert(chatLogs).values({
      userId: opts.userId,
      message: truncate(sanitizeText(opts.message, 5000), 5000),
      reply: truncate(opts.reply, 1000),
      actionType: validateActionType(opts.actionType),
      geminiCall: opts.geminiCall,
      geminiOutputUrl: truncate(opts.geminiOutputUrl ?? "", 500),
    });
  } catch (e) {
    console.error("[LOG] chat insert failed:", e);
  }
}

export async function logTts(opts: {
  userId: string;
  text: string;
  audioFilename: string;
  audioUrl: string;
  status?: string;
}): Promise<void> {
  try {
    await getDb().insert(ttsLogs).values({
      userId: opts.userId,
      text: truncate(opts.text, 5000),
      audioFilename: truncate(opts.audioFilename, 255),
      audioUrl: truncate(opts.audioUrl, 500),
      driveLink: truncate(opts.audioUrl, 500),
      status: opts.status ?? "ok",
    });
  } catch (e) {
    console.error("[LOG] tts insert failed:", e);
  }
}

export async function logVoicemail(opts: {
  userId: string;
  audioFilename: string;
  transcription: string;
  translation?: string;
  driveLink?: string;
}): Promise<void> {
  try {
    await getDb().insert(voicemailLogs).values({
      userId: opts.userId,
      audioFilename: truncate(opts.audioFilename, 255),
      transcription: truncate(opts.transcription, 5000),
      translation: truncate(opts.translation ?? "", 5000),
      driveLink: truncate(opts.driveLink ?? "", 500),
    });
  } catch (e) {
    console.error("[LOG] voicemail insert failed:", e);
  }
}
