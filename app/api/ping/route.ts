import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json({ status: "ok" });
}

export async function HEAD(): Promise<Response> {
  return new Response(null, { status: 200 });
}
