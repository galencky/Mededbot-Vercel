const NORMALIZE_MAP: Record<string, string> = {
  chinese: "中文(繁體)",
  mandarin: "中文(繁體)",
  "中文": "中文(繁體)",
  english: "英文",
  japanese: "日文",
  korean: "韓文",
  thai: "泰文",
  vietnamese: "越南文",
  indonesian: "印尼文",
  spanish: "西班牙文",
  french: "法文",
  taiwanese: "台語",
  taigi: "台語",
  "臺語": "台語",
};

export function normalizeLanguageInput(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  return NORMALIZE_MAP[lower] ?? trimmed;
}
