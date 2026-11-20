// S1: a board reports a warning/alarm. Auth: "Authorization: Bearer <truck API key>".
// Body (JSON), one event or {"events": [...]} for a queued batch (S2, sent after being offline):
//   {"id": "board-unique-id", "t": 1795145070, "level": 2, "reasons": ["eyes closed 2.1 s"],
//    "lat": 14.69, "lon": 101.41, "speed": 72, "driver": "D0012"}
// Only event data is stored, never video or photos (PDPA).
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { truckFromRequest } from "@/lib/auth";
import { num, str, boardTime } from "@/lib/validate";

export const runtime = "nodejs";
const MAX_BATCH = 200;

export async function POST(request) {
  const truck = await truckFromRequest(request);
  if (!truck) return NextResponse.json({ ok: false, error: "bad API key" }, { status: 401 });
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: "bad JSON" }, { status: 400 });
  }
  const list = Array.isArray(body?.events) ? body.events : [body];
  if (list.length > MAX_BATCH) {
    return NextResponse.json({ ok: false, error: `max ${MAX_BATCH} events per request` }, { status: 413 });
  }
  let saved = 0, skipped = 0;
  for (const e of list) {
    const level = num(e?.level, 1, 2);
    const at = boardTime(e?.t);
    if (level === null || at === null) { skipped++; continue; }
    const reasons = Array.isArray(e.reasons) ? e.reasons.slice(0, 10).map((r) => str(r, 120)).filter(Boolean) : [];
    const driverLabel = str(e.driver, 60) || [truck.driver_name, truck.driver_code].filter(Boolean).join(" · ") || null;
    const rows = await sql`
      INSERT INTO events (truck_id, event_uid, level, reasons, driver_code, happened_at, lat, lon, speed)
      VALUES (${truck.id}, ${str(e.id, 64)}, ${level}, ${reasons}, ${driverLabel}, ${at},
              ${num(e.lat, -90, 90)}, ${num(e.lon, -180, 180)}, ${num(e.speed, 0, 300)})
      ON CONFLICT (truck_id, event_uid) DO NOTHING
      RETURNING id`;
    if (rows.length) saved++; else skipped++;
  }
  return NextResponse.json({ ok: true, saved, skipped });
}
