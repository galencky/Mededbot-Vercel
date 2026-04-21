import type { Session } from "../session/types";
import { sendEmail } from "../email/service";
import { uploadTextArtifact } from "../storage/blob";

function formatReferences(refs: Session["references"]): string {
  if (!refs || !refs.length) return "";
  const lines = refs
    .map((r, i) => `${i + 1}. ${r.title}: ${r.url}`)
    .join("\n");
  return `\n\n參考來源：\n${lines}`;
}

export async function sendEducationEmail(
  userId: string,
  toEmail: string,
  session: Session,
): Promise<{ success: boolean; artifactUrl?: string }> {
  const zh = session.zh_output;
  if (!zh) return { success: false };

  const translated = session.translated_output;
  const translatedLang = session.last_translation_lang;
  const topic = session.last_topic ?? "未知主題";
  const refs = formatReferences(session.references);

  const { subject, body } = translated
    ? {
        subject: `[Mededbot-多語言衛教AI] ${translatedLang ?? "多語言"} ${topic} 衛教單張`,
        body: `📄 原文：\n${zh}\n\n🌐 譯文：\n${translated}${refs}`,
      }
    : {
        subject: `[Mededbot-多語言衛教AI] 中文 ${topic} 衛教單張`,
        body: `📄 中文衛教內容：\n${zh}${refs}\n\n提醒：此內容尚未翻譯。如需多語言版本，請於 LINE 輸入『翻譯』進行語言轉換。`,
      };

  let artifactUrl: string | undefined;
  try {
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
    const archive = [
      `User ID: ${userId}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `Topic: ${topic}`,
      `Translated Language: ${translatedLang ?? "(none)"}`,
      `Timestamp: ${new Date().toISOString()}`,
      "",
      "---",
      body,
    ].join("\n");

    artifactUrl = await uploadTextArtifact(
      `${userId}-email-${ts}.txt`,
      archive,
      `text/${userId}`,
    );
  } catch (err) {
    console.error("[EMAIL] artifact upload failed:", err);
  }

  const success = await sendEmail(toEmail, subject, body);
  return { success, artifactUrl };
}
