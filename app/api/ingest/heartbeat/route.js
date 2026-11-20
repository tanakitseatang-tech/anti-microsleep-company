// S3: a board says "I'm alive" about once a minute. Auth: "Authorization: Bearer <truck API key>".
// Body: {"lat": 14.69, "lon": 101.41, "speed": 72, "level": 0, "camera_ok": true, "version": "2026-11-20"}
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { truckFromRequest } from "@/lib/auth";
import { num, str } from "@/lib/validate";
import { escalateOverdue } from "@/lib/escalate";

export const runtime = "nodejs";

export async function POST(request) {
  const truck = await truckFromRequest(request);
  if (!truck) return NextResponse.json({ ok: false, error: "bad API key" }, { status: 401 });
  let b;
  try { b = await request.json(); } catch { b = {}; }
  const lat = num(b.lat, -90, 90), lon = num(b.lon, -180, 180);
  await sql`
    UPDATE trucks SET
      last_seen   = now(),
      last_lat    = COALESCE(${lat}, last_lat),
      last_lon    = COALESCE(${lon}, last_lon),
      last_speed  = ${num(b.speed, 0, 300)},
      last_level  = ${num(b.level, 0, 2)},
      camera_ok   = ${typeof b.camera_ok === "boolean" ? b.camera_ok : null},
      app_version = ${str(b.version, 40)}
    WHERE id = ${truck.id}`;
  // C3: red alarm still open after 1 minute (driver did not press "ฉันตื่นแล้ว") → admin LINE
  try {
    await escalateOverdue({ truckId: truck.id, origin: new URL(request.url).origin });
  } catch (err) {
    console.error("LINE escalate error:", err?.message);
  }
  return NextResponse.json({ ok: true, server_time: Math.floor(Date.now() / 1000) });
}
