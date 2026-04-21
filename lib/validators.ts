const LINE_USER_ID = /^U[0-9a-fA-F]{32}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function sanitizeUserId(userId: string): string {
  if (!userId || !LINE_USER_ID.test(userId)) {
    throw new Error(`Invalid LINE user ID: ${userId}`);
  }
  return userId;
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.normalize("NFKD").replace(/[^\w\s.-]/g, "").trim();
  if (!cleaned) throw new Error("Filename empty after sanitization");
  return cleaned.slice(0, 255);
}

export function validateEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254) throw new Error("Email too long");
  if (/[\n\r\0]/.test(email)) throw new Error("Email contains control characters");
  if (!EMAIL_RE.test(email)) throw new Error("Invalid email format");
  return email;
}

export function sanitizeText(text: string, maxLen = 5000): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLen);
}

const ALLOWED_ACTIONS = new Set([
  "edu", "chat", "translate", "tts", "email", "modify", "voicemail",
  "new", "help", "other", "sync reply", "medchat_audio", "Gemini reply",
  "medchat", "exception", "audio", "text", "voice", "speak",
  "medchat audio", "Email sent", "Email failed",
]);

export function validateActionType(action: string): string {
  return ALLOWED_ACTIONS.has(action) ? action : "other";
}
