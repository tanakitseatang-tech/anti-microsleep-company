// Driver pressed "ฉันตื่นแล้ว / แวะพักแล้ว" on the board's driver.html screen.
// Closes all open alert cases for this truck so the company sees the driver responded.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { truckFromRequest } from "@/lib/auth";
import { str } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(request) {
  const truck = await truckFromRequest(request);
  if (!truck) return NextResponse.json({ ok: false, error: "bad truck auth" }, { status: 401 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const note = str(b.note, 300) || "คนขับกดยืนยันว่าตื่นแล้ว";
  const rows = await sql`
    UPDATE events
    SET closed_at = now(), close_note = ${note}
    WHERE truck_id = ${truck.id} AND closed_at IS NULL
    RETURNING id`;
  return NextResponse.json({ ok: true, closed: rows.length });
}
