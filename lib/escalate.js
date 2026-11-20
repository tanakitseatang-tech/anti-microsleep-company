// C3: tell the admin on LINE when a red alarm stays open — the driver did not press
// "ฉันตื่นแล้ว" on the board within ACK_WAIT_S. Drivers who respond in time cause no message.
//
// Runs on every board heartbeat (about every 5 s) and event, and when someone opens the
// dashboard or alerts page (so it still fires if the board lost its connection).
import { sql, rawQuery } from "./db";
import { lineConfigured, sendLine, alarmText } from "./line";
import { lineEnabled } from "./settings";

export const ACK_WAIT_S = 60;          // driver has 1 minute to press "ฉันตื่นแล้ว"
const MAX_AGE_MIN = 30;                // ignore alarms older than this (e.g. sent after being offline long)
const PER_TRUCK_EVERY_S = 300;         // at most one LINE per truck per 5 minutes

let ready = false;
async function ensureColumns() {
  if (ready) return;
  await rawQuery(`ALTER TABLE events ADD COLUMN IF NOT EXISTS line_sent_at TIMESTAMPTZ`);
  await rawQuery(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS last_line_at TIMESTAMPTZ`);
  ready = true;
}

// truckId: only this truck (heartbeat / event), or null for all trucks (page loads).
// origin: website address for the link in the message.
export async function escalateOverdue({ truckId = null, origin = "" } = {}) {
  if (!lineConfigured() || !(await lineEnabled())) return [];
  await ensureColumns();
  // Claim overdue open red alarms atomically, so parallel calls never send twice.
  const claimed = await sql`
    UPDATE events SET line_sent_at = now()
    WHERE id IN (
      SELECT id FROM events
      WHERE level = 2 AND closed_at IS NULL AND line_sent_at IS NULL
        AND received_at < now() - make_interval(secs => ${ACK_WAIT_S})
        AND happened_at > now() - make_interval(mins => ${MAX_AGE_MIN})
        AND (${truckId}::int IS NULL OR truck_id = ${truckId}::int)
      ORDER BY happened_at
      LIMIT 50
      FOR UPDATE SKIP LOCKED)
    RETURNING truck_id, happened_at, reasons, speed, lat, lon`;
  if (!claimed.length) return [];

  const byTruck = new Map();
  for (const e of claimed) {
    const cur = byTruck.get(e.truck_id);
    if (!cur) byTruck.set(e.truck_id, { newest: e, count: 1 });
    else {
      cur.count++;
      if (e.happened_at > cur.newest.happened_at) cur.newest = e;
    }
  }

  const results = [];
  for (const [id, { newest, count }] of byTruck) {
    const rows = await sql`
      UPDATE trucks SET last_line_at = now()
      WHERE id = ${id}
        AND (last_line_at IS NULL OR last_line_at < now() - make_interval(secs => ${PER_TRUCK_EVERY_S}))
      RETURNING code, name, brand, model, driver_code, driver_name, driver_phone`;
    if (!rows.length) { results.push({ truck: id, skipped: "rate-limited" }); continue; }
    const text = alarmText({ truck: rows[0], event: newest, siteUrl: origin, waitedS: ACK_WAIT_S, count });
    const res = await sendLine(text);
    if (!res.ok) console.error("LINE send failed:", res.status, res.error);
    results.push({ truck: id, ...res });
  }
  return results;
}
