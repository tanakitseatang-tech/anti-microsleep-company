// S1: a board reports a warning/alarm. Auth: "Authorization: Bearer <truck API key>".
// Body (JSON), one event or {"events": [...]} for a queued batch (S2, sent after being offline):
//   {"id": "board-unique-id", "t": 1795145070, "level": 2, "reasons": ["eyes closed 2.1 s"],
//    "lat": 14.69, "lon": 101.41, "speed": 72, "driver": "D0012"}
// Only event data is stored, never video or photos (PDPA).
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { truckFromRequest } from "@/lib/auth";
import { num, str, boardTime } from "@/lib/validate";
import { lineConfigured, sendLine, alarmText } from "@/lib/line";

export const runtime = "nodejs";
const MAX_BATCH = 200;
const LINE_EVERY_S = 120;        // at most one LINE message per truck per 2 minutes
const LINE_MAX_AGE_S = 600;      // queued alarms older than 10 min (sent after being offline) don't ping LINE

// C3: tell LINE about the newest fresh red alarm, rate-limited per truck.
async function notifyLine(truckId, ev, request) {
  if (!lineConfigured() || !ev) return null;
  if (Date.now() - ev.happened_at.getTime() > LINE_MAX_AGE_S * 1000) return null;
  // claim the slot atomically, so two requests at once send only one message
  const rows = await sql`
    UPDATE trucks SET last_line_at = now()
    WHERE id = ${truckId}
      AND (last_line_at IS NULL OR last_line_at < now() - make_interval(secs => ${LINE_EVERY_S}))
    RETURNING code, name, brand, model, driver_code, driver_name, driver_phone`;
  if (!rows.length) return { skipped: "rate-limited" };
  const siteUrl = new URL(request.url).origin;
  const res = await sendLine(alarmText({ truck: rows[0], event: ev, siteUrl }));
  if (!res.ok) console.error("LINE send failed:", res.status, res.error);
  return res;
}

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
  let newestAlarm = null;
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
    if (rows.length) {
      saved++;
      if (level === 2 && (!newestAlarm || at > newestAlarm.happened_at)) {
        newestAlarm = { happened_at: at, reasons, speed: num(e.speed, 0, 300),
                        lat: num(e.lat, -90, 90), lon: num(e.lon, -180, 180) };
      }
    } else skipped++;
  }
  let line = null;
  try {
    line = await notifyLine(truck.id, newestAlarm, request);
  } catch (err) {
    console.error("LINE notify error:", err?.message);   // never lose the saved events over LINE
  }
  return NextResponse.json({ ok: true, saved, skipped, line: line ? (line.ok ? "sent" : line.skipped || "failed") : undefined });
}
