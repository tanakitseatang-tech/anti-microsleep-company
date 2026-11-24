// C3: tell the admin on LINE when
//   1. a red alarm stays open — the driver did not press "ฉันตื่นแล้ว" within ACK_WAIT_S,
//   2. the board reports "driver not visible" (no face for 60 s during a shift, not resting),
//   3. a rest runs REST_GRACE_MIN past its end and the driver is not back (board did not clear it).
// Drivers who respond in time cause no message.
//
// Runs on every board heartbeat (about every 5 s) and event, when someone opens the dashboard
// or alerts page, and from /api/cron/escalate (an outside timer, so it also fires while the
// truck is switched off and nobody has the website open).
import { sql, rawQuery } from "./db";
import { lineConfigured, sendLine, alarmText, noDriverText, restOverdueText } from "./line";
import { lineEnabled } from "./settings";

export const ACK_WAIT_S = 60;          // driver has 1 minute to press "ฉันตื่นแล้ว"
export const REST_GRACE_MIN = 15;      // rest may run this long past its end before LINE
const MAX_AGE_MIN = 30;                // ignore alarms older than this (e.g. sent after being offline long)
const PER_TRUCK_EVERY_S = 300;         // at most one LINE per truck per 5 minutes
const NO_DRIVER_PREFIX = "driver not visible";

let ready = false;
async function ensureColumns() {
  if (ready) return;
  await rawQuery(`ALTER TABLE events ADD COLUMN IF NOT EXISTS line_sent_at TIMESTAMPTZ`);
  await rawQuery(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS last_line_at TIMESTAMPTZ`);
  await rawQuery(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS rest_until TIMESTAMPTZ`);
  await rawQuery(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS rest_line_at TIMESTAMPTZ`);
  ready = true;
}

// LINE did not take the message for a reason that may pass (network, timeout, LINE server
// error, our own 5-minute limit) -> try again on the next check. Not for 4xx (bad token, quota).
// A timeout counts as sent: LINE may have delivered it, and a second copy is worse than none.
// 429 = LINE asks us to slow down: try again later.
const retryable = (res) => !res.ok && !res.timeout && (res.status == null || res.status === 429 || res.status >= 500);

// truckId: only this truck (heartbeat / event), or null for all trucks (page loads, cron).
// origin: website address for the link in the message.
export async function escalateOverdue({ truckId = null, origin = "" } = {}) {
  if (!lineConfigured() || !(await lineEnabled())) return [];
  await ensureColumns();
  const results = [];

  // 1 + 2: claim overdue events atomically, so parallel calls never send twice.
  const claimed = await sql`
    UPDATE events SET line_sent_at = now()
    WHERE id IN (
      SELECT id FROM events
      WHERE closed_at IS NULL AND line_sent_at IS NULL
        AND happened_at > now() - make_interval(mins => ${MAX_AGE_MIN})
        AND (
          (level = 2 AND received_at < now() - make_interval(secs => ${ACK_WAIT_S}))
          OR array_to_string(reasons, ' ') LIKE ${NO_DRIVER_PREFIX + "%"}
        )
        AND (${truckId}::int IS NULL OR truck_id = ${truckId}::int)
      ORDER BY happened_at
      LIMIT 50
      FOR UPDATE SKIP LOCKED)
    RETURNING id, truck_id, level, happened_at, reasons, speed, lat, lon`;

  const byTruck = new Map();
  for (const e of claimed) {
    const cur = byTruck.get(e.truck_id);
    if (!cur) byTruck.set(e.truck_id, { newest: e, count: 1, ids: [e.id] });
    else {
      cur.count++;
      cur.ids.push(e.id);
      // a RED alarm always wins over a yellow "driver not visible" in the message
      const better = e.level > cur.newest.level ||
        (e.level === cur.newest.level && e.happened_at > cur.newest.happened_at);
      if (better) cur.newest = e;
    }
  }

  for (const [id, { newest, count, ids }] of byTruck) {
    const rows = await sql`
      UPDATE trucks SET last_line_at = now()
      WHERE id = ${id}
        AND (last_line_at IS NULL OR last_line_at < now() - make_interval(secs => ${PER_TRUCK_EVERY_S}))
      RETURNING code, name, brand, model, driver_code, driver_name, driver_phone, last_lat, last_lon`;
    let res;
    if (!rows.length) {
      res = { ok: false, skipped: "rate-limited" };
    } else {
      const noDriver = newest.level !== 2 && String(newest.reasons?.[0] || "").startsWith(NO_DRIVER_PREFIX);
      const text = noDriver
        ? noDriverText({ truck: rows[0], event: newest, siteUrl: origin })
        : alarmText({ truck: rows[0], event: newest, siteUrl: origin, waitedS: ACK_WAIT_S, count });
      res = await sendLine(text);
      if (!res.ok) console.error("LINE send failed:", res.status, res.error);
    }
    if (res.skipped || retryable(res)) {
      // not sent: release the events so a later check sends them (within MAX_AGE_MIN)
      await sql`UPDATE events SET line_sent_at = NULL WHERE id = ANY(${ids}::bigint[])`;
      if (rows.length) await sql`UPDATE trucks SET last_line_at = NULL WHERE id = ${id}`;
    }
    results.push({ truck: id, ...res });
  }

  // 3: rest overdue. The board clears rest_until when the driver is back (face seen or
  // "ขับต่อ"); still set REST_GRACE_MIN after the rest ended -> one LINE per rest.
  const rests = await sql`
    UPDATE trucks SET rest_line_at = now()
    WHERE rest_until IS NOT NULL AND rest_line_at IS NULL AND key_revoked = false
      AND rest_until < now() - make_interval(mins => ${REST_GRACE_MIN})
      AND rest_until > now() - interval '12 hours'
      AND (${truckId}::int IS NULL OR id = ${truckId}::int)
    RETURNING id, code, name, brand, model, driver_code, driver_name, driver_phone,
              rest_until, last_seen, last_lat, last_lon`;
  for (const t of rests) {
    const res = await sendLine(restOverdueText({ truck: t, siteUrl: origin, graceMin: REST_GRACE_MIN }));
    if (!res.ok) console.error("LINE send failed (rest):", res.status, res.error);
    if (retryable(res)) await sql`UPDATE trucks SET rest_line_at = NULL WHERE id = ${t.id}`;
    results.push({ truck: t.id, rest: true, ...res });
  }
  return results;
}
