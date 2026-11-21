// Driver pressed "ฉันตื่นแล้ว / แวะพักแล้ว" on the board's driver.html screen.
// Closes the truck's open alert cases that happened BEFORE the press (body "t", unix s), so a
// new alarm queued while offline and uploaded after the press stays open and can still escalate.
// Boards that send no "t" close all open cases, as before.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { truckFromRequest } from "@/lib/auth";
import { str, boardTime } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(request) {
  const truck = await truckFromRequest(request);
  if (!truck) return NextResponse.json({ ok: false, error: "bad truck auth" }, { status: 401 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const note = str(b.note, 300) || "คนขับกดยืนยันว่าตื่นแล้ว";
  const pressedAt = boardTime(b.t);           // null when missing or not a sane time
  const rows = await sql`
    UPDATE events
    SET closed_at = now(), close_note = ${note}
    WHERE truck_id = ${truck.id} AND closed_at IS NULL
      AND (${pressedAt}::timestamptz IS NULL OR happened_at <= ${pressedAt}::timestamptz)
    RETURNING id`;
  return NextResponse.json({ ok: true, closed: rows.length });
}
