import { uploadAudio } from "../storage/blob";
import { sanitizeUserId, sanitizeFilename } from "../validators";
import { estimateWavDurationMs } from "../audio/wav";
import { logTts } from "../logging";

const TAIGI_BASE = "http://tts001.ivoice.tw:8804";
const TLPA_PATH = "/html_taigi_zh_tw_py";
const SYNTH_PATH = "/synthesize_TLPA";

const GENDER = { female: "女聲", male: "男聲" } as const;
const ACCENT = {
  strong: "強勢腔（高雄腔）",
  second: "次強勢腔（台北腔）",
} as const;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function translateToTaigi(text: string): Promise<string> {
  try {
    const url = `${TAIGI_BASE}${TLPA_PATH}?text0=${encodeURIComponent(text)}`;
    const res = await fetchWithTimeout(url, 20000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.text()).trim();
    if (!body) throw new Error("Server returned empty TLPA string");
    return body;
  } catch (err) {
    console.error("[TAIGI] translate error:", err);
    if (err instanceof Error && err.name === "AbortError") {
      return "⚠️ 台語翻譯服務逾時，請稍後再試。";
    }
    return "⚠️ 台語翻譯服務暫時無法使用，請稍後再試。";
  }
}

export async function taigiTts(opts: {
  tlpa: string;
  gender?: keyof typeof GENDER;
  accent?: keyof typeof ACCENT;
}): Promise<Buffer> {
  const params = new URLSearchParams({
    text1: opts.tlpa,
    gender: GENDER[opts.gender ?? "female"],
    accent: ACCENT[opts.accent ?? "strong"],
  });
  const url = `${TAIGI_BASE}${SYNTH_PATH}?${params.toString()}`;
  const res = await fetchWithTimeout(url, 60000);
  if (!res.ok) throw new Error(`Taigi synth HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("Taigi synth returned empty audio");
  return buf;
}

export interface TaigiTtsResult {
  url: string;
  durationMs: number;
}

export async function synthesizeTaigi(
  text: string,
  userId: string,
): Promise<TaigiTtsResult> {
  const safeUserId = sanitizeUserId(userId);
  const tlpa = await translateToTaigi(text);
  if (tlpa.startsWith("⚠️")) throw new Error(tlpa);

  const wav = await taigiTts({ tlpa, gender: "female", accent: "strong" });
  const durationMs = estimateWavDurationMs(wav, { sampleRate: 16000 });

  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
  const filename = sanitizeFilename(`${safeUserId}_taigi_${ts}.wav`);
  const url = await uploadAudio(filename, wav, "audio/wav");

  void logTts({
    userId: safeUserId,
    text,
    audioFilename: filename,
    audioUrl: url,
  });

  return { url, durationMs };
}
