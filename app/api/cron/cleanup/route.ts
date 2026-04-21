import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const expected = env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;

  if (!isVercelCron && expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    note: "Sessions auto-expire via Redis TTL; Blob retention is managed by Vercel.",
    timestamp: new Date().toISOString(),
  });
}
