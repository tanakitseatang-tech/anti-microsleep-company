// PDPA: delete alert events older than 90 days. Called daily by Vercel Cron (vercel.json),
// which sends "Authorization: Bearer <CRON_SECRET>".
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
const KEEP_DAYS = 90;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const rows = await sql`
    DELETE FROM events WHERE happened_at < now() - make_interval(days => ${KEEP_DAYS})
    RETURNING id`;
  return NextResponse.json({ ok: true, deleted: rows.length });
}
