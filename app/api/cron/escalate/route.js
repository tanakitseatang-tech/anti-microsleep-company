// LINE checks for all trucks (lib/escalate.js): driver did not respond to a red alarm,
// driver not visible, rest 15 min overdue. Heartbeats and page loads already run them; this
// route is for an outside timer (e.g. cron-job.org, every 1 minute) so the checks also run
// while the truck is switched off and nobody has the website open (Vercel Hobby cron = daily only).
// If CRON_SECRET is set, call it with "Authorization: Bearer <CRON_SECRET>" or "?key=<CRON_SECRET>".
import { NextResponse } from "next/server";
import { escalateOverdue } from "@/lib/escalate";
import { ensureTruckColumns } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}` && url.searchParams.get("key") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await ensureTruckColumns();
  const sent = await escalateOverdue({ origin: url.origin });
  return NextResponse.json({ ok: true, checked: true, count: sent.length, results: sent });
}
