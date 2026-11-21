// S3: a board says "I'm alive" about once a minute. Auth: "Authorization: Bearer <truck API key>".
// Body: {"lat": 14.69, "lon": 101.41, "speed": 72, "level": 0, "camera_ok": true, "version": "2026-11-20"}
import { NextResponse } from "next/server";
import { sql, ensureTruckColumns, normalizeDriverCode } from "@/lib/db";
import { truckFromRequest } from "@/lib/auth";
import { num, str } from "@/lib/validate";
import { escalateOverdue } from "@/lib/escalate";

export const runtime = "nodejs";

export async function POST(request) {
  await ensureTruckColumns();
  const truck = await truckFromRequest(request);
  if (!truck) return NextResponse.json({ ok: false, error: "bad API key" }, { status: 401 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const lat = num(b.lat, -90, 90), lon = num(b.lon, -180, 180);
  // board's own Wi-Fi address (for the /go/<truck> link to the driver page) + the internet
  // address it sends from (the driver's phone hotspot), used by /go to find "my" truck
  const localIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(String(b.local_ip || "")) ? b.local_ip : null;
  const publicIp = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null;

  // If the board sends a driver_code (e.g. "001" from shift check-in), resolve against the drivers directory
  const rawDriverCode = typeof b.driver_code === "string" ? b.driver_code.trim() : null;
  let matchedDriver = null;
  if (rawDriverCode) {
    const norm = normalizeDriverCode(rawDriverCode.replace(/^EMP/i, ""));
    const [found] = await sql`
      SELECT code, name, phone FROM drivers
      WHERE UPPER(code) = ${norm}
         OR UPPER(code) = ${"EMP" + norm}
         OR REGEXP_REPLACE(UPPER(code), '^EMP', '') = ${norm}
      LIMIT 1`;
    if (found) {
      matchedDriver = found;
      await sql`
        UPDATE trucks SET
          last_seen    = now(),
          last_lat     = COALESCE(${lat}, last_lat),
          last_lon     = COALESCE(${lon}, last_lon),
          last_speed   = ${num(b.speed, 0, 300)},
          last_level   = ${num(b.level, 0, 2)},
          camera_ok    = ${typeof b.camera_ok === "boolean" ? b.camera_ok : null},
          app_version  = ${str(b.version, 40)},
          local_ip     = ${localIp},
          wifi_ssid    = ${str(b.wifi, 64)},
          public_ip    = ${publicIp},
          driver_code  = ${found.code},
          driver_name  = ${found.name},
          driver_phone = COALESCE(${found.phone}, driver_phone)
        WHERE id = ${truck.id}`;
    } else {
      await sql`
        UPDATE trucks SET
          last_seen    = now(),
          last_lat     = COALESCE(${lat}, last_lat),
          last_lon     = COALESCE(${lon}, last_lon),
          last_speed   = ${num(b.speed, 0, 300)},
          last_level   = ${num(b.level, 0, 2)},
          camera_ok    = ${typeof b.camera_ok === "boolean" ? b.camera_ok : null},
          app_version  = ${str(b.version, 40)},
          local_ip     = ${localIp},
          wifi_ssid    = ${str(b.wifi, 64)},
          public_ip    = ${publicIp},
          driver_code  = ${norm},
          driver_name  = CASE WHEN UPPER(COALESCE(driver_code, '')) = ${norm} THEN driver_name ELSE NULL END,
          driver_phone = CASE WHEN UPPER(COALESCE(driver_code, '')) = ${norm} THEN driver_phone ELSE NULL END
        WHERE id = ${truck.id}`;
    }
  } else {
    await sql`
      UPDATE trucks SET
        last_seen   = now(),
        last_lat    = COALESCE(${lat}, last_lat),
        last_lon    = COALESCE(${lon}, last_lon),
        last_speed  = ${num(b.speed, 0, 300)},
        last_level  = ${num(b.level, 0, 2)},
        camera_ok   = ${typeof b.camera_ok === "boolean" ? b.camera_ok : null},
        app_version = ${str(b.version, 40)},
        local_ip    = ${localIp},
        wifi_ssid   = ${str(b.wifi, 64)},
        public_ip   = ${publicIp}
      WHERE id = ${truck.id}`;
  }

  // Rest: the driver picked a rest length on the board ("rest_until", unix s; null = driving).
  // A new rest (other end time) clears rest_line_at, so each rest can trigger at most one LINE.
  const ru = num(b.rest_until, 1.5e9, 4e9);
  const restUntil = ru !== null && Math.abs(ru * 1000 - Date.now()) < 24 * 3600e3 ? new Date(ru * 1000) : null;
  await sql`
    UPDATE trucks SET
      rest_line_at = CASE WHEN rest_until IS DISTINCT FROM ${restUntil}::timestamptz THEN NULL ELSE rest_line_at END,
      rest_until   = ${restUntil}::timestamptz
    WHERE id = ${truck.id}`;

  // Send compact employee directory back so the board can show names offline when typing 3-digit code
  let drivers = [];
  try {
    drivers = await sql`SELECT code, name FROM drivers ORDER BY code ASC LIMIT 200`;
  } catch {}

  // C3: red alarm still open after 1 minute (driver did not press "ฉันตื่นแล้ว") → admin LINE
  try {
    await escalateOverdue({ truckId: truck.id, origin: new URL(request.url).origin });
  } catch (err) {
    console.error("LINE escalate error:", err?.message);
  }
  return NextResponse.json({
    ok: true,
    server_time: Math.floor(Date.now() / 1000),
    driver: matchedDriver,
    drivers,
  });
}
