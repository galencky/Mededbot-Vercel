import nodemailer from "nodemailer";
import { promises as dns } from "node:dns";
import { env } from "../env";

const DISCLAIMER =
  "【免責聲明】本郵件內容由 AI 自動生成，僅供衛生教育參考，不構成醫療診斷或建議。請諮詢專業醫療人員以獲得正確的醫療意見。\n\n";

let _transport: nodemailer.Transporter | null = null;
function transport(): nodemailer.Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: env.GMAIL_ADDRESS,
        pass: env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transport;
}

export async function hasMxRecord(domain: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const result = await Promise.race([
      dns.resolveMx(domain),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    return Array.isArray(result) && result.length > 0;
  } catch {
    return false;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<boolean> {
  try {
    await transport().sendMail({
      from: env.GMAIL_ADDRESS,
      to,
      subject,
      text: DISCLAIMER + body,
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] send failed:", err);
    return false;
  }
}
