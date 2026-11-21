// C2 + C9: dashboard — all trucks on a map, vehicle & driver info, click-to-focus, who is offline, today's alerts.
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { LEVEL_TH, thTime, isOnline, thReasons } from "@/lib/format";
import TruckMap from "./components/TruckMap";
import FocusTruckButton from "./components/FocusTruckButton";
import AutoRefresh from "./components/AutoRefresh";
import { escalateFromPage } from "@/lib/escalatePage";

export const dynamic = "force-dynamic";

// Driver resting (picked on the board): "☕ พักถึง 14:30" or, once over, "☕ พักเกินเวลา +8 นาที".
function restInfo(restUntil) {
  if (!restUntil) return null;
  const end = new Date(restUntil).getTime();
  const overMin = Math.floor((Date.now() - end) / 60e3);
  if (overMin > 12 * 60) return null;                  // stale (board never came back)
  const hhmm = new Date(end).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  return Date.now() < end
    ? { over: false, text: `☕ พักถึง ${hhmm}` }
    : { over: true, text: `☕ พักเกินเวลา +${Math.max(0, overMin)} นาที` };
}

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const manage = user.role === "admin" || user.role === "manager";
  await ensureTruckColumns();
  await escalateFromPage();
  const trucks = await sql`
    SELECT t.id, t.code, t.name, t.brand, t.model, t.vehicle_info,
           t.driver_code, t.driver_name, t.driver_phone,
           t.last_seen, t.last_lat, t.last_lon, t.last_speed, t.last_level, t.camera_ok, t.rest_until, t.sim_drive,
           (SELECT count(*)::int FROM events e WHERE e.truck_id = t.id AND e.closed_at IS NULL) AS open_alerts,
           (SELECT count(*)::int FROM events e WHERE e.truck_id = t.id AND e.closed_at IS NULL AND e.level = 2) AS open_red,
           (SELECT json_build_object('id', e.id, 'level', e.level, 'reasons', e.reasons, 'at', e.happened_at,
                                     'open', e.closed_at IS NULL)
              FROM events e WHERE e.truck_id = t.id AND NOT e.archived ORDER BY e.happened_at DESC LIMIT 1) AS last_event
    FROM trucks t WHERE t.key_revoked = false ORDER BY t.code`;
  const [today] = await sql`
    SELECT count(*) FILTER (WHERE level = 2)::int AS alarms, count(*)::int AS total
    FROM events WHERE NOT archived AND happened_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'`;

  const rows = trucks.map((t) => ({
    code: t.code,
    name: t.name,
    brand: t.brand,
    model: t.model,
    vehicle_info: t.vehicle_info,
    driver_code: t.driver_code,
    driver_name: t.driver_name,
    driver_phone: t.driver_phone,
    lat: t.last_lat,
    lon: t.last_lon,
    level: t.last_level,
    online: isOnline(t.last_seen),
    seen: thTime(t.last_seen),
    speed: t.last_speed,
    camera_ok: t.camera_ok,
    rest: restInfo(t.rest_until),
    sim_drive: !!t.sim_drive,
    open: t.open_alerts,
    open_red: t.open_red,
    last_event: t.last_event
      ? { id: t.last_event.id, level: t.last_event.level, reasons: thReasons(t.last_event.reasons), at: thTime(t.last_event.at), open: t.last_event.open }
      : null,
  }));
  const online = rows.filter((r) => r.online).length;

  return (
    <>
      <AutoRefresh seconds={5} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h1>แผนที่รถและข้อมูลผู้ขับทุกคัน</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href="/reports">📊 รายงานวิเคราะห์ & Heatmap</Link>
          {manage && <Link className="btn" href="/trucks">📋 จัดการรถ / นำเข้า Datasheet พนักงาน</Link>}
        </div>
      </div>
      <TruckMap trucks={rows} today={today} canManage={manage} />
    </>
  );
}
