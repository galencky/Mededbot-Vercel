import type { WebhookRequestBody } from "@line/bot-sdk";
import { NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line/client";
import { processWebhookEvent } from "@/lib/handlers/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get("x-line-signature") ?? "";
  const body = await req.text();

  if (!verifyLineSignature(body, signature)) {
    console.warn("[WEBHOOK] signature mismatch");
    return NextResponse.json({ ok: true });
  }

  let parsed: WebhookRequestBody;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: true });
  }

  await Promise.all(
    (parsed.events ?? []).map(async (event) => {
      try {
        await processWebhookEvent(event);
      } catch (err) {
        console.error("[WEBHOOK] event error:", err);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true, service: "mededbot-webhook" });
}
