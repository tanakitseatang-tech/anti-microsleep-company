// C3: admin switch — turn LINE alerts on or off (stored in the database, takes effect at once).
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { sql, rawQuery } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ ok: false, error: "admin only" }, { status: 403 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  if (typeof b.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "enabled must be true or false" }, { status: 400 });
  }
  if (b.enabled) {
    // Turning LINE on: old cases and old rests must not all be sent at once.
    // Mark what already exists as "handled"; only things that happen from now on go to LINE.
    try {
      await rawQuery(`ALTER TABLE events ADD COLUMN IF NOT EXISTS line_sent_at TIMESTAMPTZ`);
      await sql`UPDATE events SET line_sent_at = now() WHERE line_sent_at IS NULL AND closed_at IS NULL`;
      await sql`UPDATE trucks SET rest_line_at = now() WHERE rest_until IS NOT NULL AND rest_line_at IS NULL`;
    } catch (e) {
      console.error("LINE on: could not mark old cases", e?.message);
    }
  }
  await setSetting("line_enabled", b.enabled ? "1" : "0");
  console.log(`LINE alerts ${b.enabled ? "ON" : "OFF"} by ${user.username}`);
  return NextResponse.json({ ok: true, enabled: b.enabled });
}
