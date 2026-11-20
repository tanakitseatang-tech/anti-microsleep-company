// C2 + C9: dashboard — all trucks on a map, who is offline, today's alerts.
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { LEVEL_TH, thTime, isOnline } from "@/lib/format";
import TruckMap from "./components/TruckMap";
import AutoRefresh from "./components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!(await currentUser())) redirect("/login");   // also checked in middleware.js
  const trucks = await sql`
    SELECT t.id, t.code, t.name, t.last_seen, t.last_lat, t.last_lon, t.last_speed, t.last_level, t.camera_ok,
           (SELECT count(*)::int FROM events e WHERE e.truck_id = t.id AND e.closed_at IS NULL) AS open_alerts
    FROM trucks t WHERE t.key_revoked = false ORDER BY t.code`;
  const [today] = await sql`
    SELECT count(*) FILTER (WHERE level = 2)::int AS alarms, count(*)::int AS total
    FROM events WHERE happened_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'`;

  const rows = trucks.map((t) => ({
    code: t.code, name: t.name, lat: t.last_lat, lon: t.last_lon, level: t.last_level,
    online: isOnline(t.last_seen), seen: thTime(t.last_seen),
    speed: t.last_speed, camera_ok: t.camera_ok, open: t.open_alerts,
  }));
  const online = rows.filter((r) => r.online).length;

  return (
    <>
      <AutoRefresh seconds={30} />
      <h1>แผนที่รถทุกคัน</h1>
      <div className="tiles">
        <div className="tile"><div className="k">รถออนไลน์</div><div className="v">{online} / {rows.length}</div></div>
        <div className="tile"><div className="k">ขาดการติดต่อ</div><div className="v">{rows.length - online}</div></div>
        <div className="tile"><div className="k">แจ้งเตือนวันนี้</div><div className="v">{today.total}</div></div>
        <div className="tile"><div className="k">อันตราย (แดง) วันนี้</div><div className="v">{today.alarms}</div></div>
      </div>
      <div className="card"><TruckMap trucks={rows} /></div>
      <div className="card">
        <table>
          <thead>
            <tr><th>รถ</th><th>สถานะ</th><th>ความเร็ว</th><th>กล้อง</th><th>เคสค้าง</th><th>ติดต่อล่าสุด</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td><b>{r.code}</b> {r.name && <span className="muted">{r.name}</span>}</td>
                <td>
                  {r.online
                    ? <span className={`pill l${r.level ?? 0}`}>{LEVEL_TH[r.level ?? 0]}</span>
                    : <span className="pill off">ขาดการติดต่อ</span>}
                </td>
                <td>{r.speed == null ? "—" : `${Math.round(r.speed)} กม./ชม.`}</td>
                <td>{r.camera_ok == null ? "—" : r.camera_ok ? "ปกติ" : "⚠️ ไม่มีภาพ"}</td>
                <td>{r.open || "—"}</td>
                <td>{r.seen}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="muted">ยังไม่มีรถ — เพิ่มด้วย npm run add-truck</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
