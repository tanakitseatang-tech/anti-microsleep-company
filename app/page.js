// C2 + C9: dashboard — all trucks on a map, vehicle & driver info, who is offline, today's alerts.
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { LEVEL_TH, thTime, isOnline } from "@/lib/format";
import TruckMap from "./components/TruckMap";
import AutoRefresh from "./components/AutoRefresh";
import { escalateFromPage } from "@/lib/escalatePage";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!(await currentUser())) redirect("/login");
  await ensureTruckColumns();
  await escalateFromPage();
  const trucks = await sql`
    SELECT t.id, t.code, t.name, t.brand, t.model, t.vehicle_info,
           t.driver_code, t.driver_name, t.driver_phone,
           t.last_seen, t.last_lat, t.last_lon, t.last_speed, t.last_level, t.camera_ok,
           (SELECT count(*)::int FROM events e WHERE e.truck_id = t.id AND e.closed_at IS NULL) AS open_alerts
    FROM trucks t WHERE t.key_revoked = false ORDER BY t.code`;
  const [today] = await sql`
    SELECT count(*) FILTER (WHERE level = 2)::int AS alarms, count(*)::int AS total
    FROM events WHERE happened_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'`;

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
    open: t.open_alerts,
  }));
  const online = rows.filter((r) => r.online).length;

  return (
    <>
      <AutoRefresh seconds={5} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h1>แผนที่รถและข้อมูลผู้ขับทุกคัน</h1>
        <Link className="btn" href="/trucks">📋 จัดการรถ / นำเข้า Datasheet พนักงาน</Link>
      </div>
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
            <tr>
              <th>รหัสรถ / ทะเบียน</th>
              <th>ยี่ห้อ / ข้อมูลรถ</th>
              <th>ผู้ขับรถ (พนักงาน)</th>
              <th>สถานะ</th>
              <th>ความเร็ว</th>
              <th>กล้อง</th>
              <th>เคสค้าง</th>
              <th>ติดต่อล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const carTitle = [r.brand, r.model].filter(Boolean).join(" ");
              return (
                <tr key={r.code}>
                  <td>
                    <b>คันที่ {r.code}</b>
                    {r.name && <div className="muted" style={{ fontSize: 13 }}>{r.name}</div>}
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: 160 }}>
                    {carTitle ? <b>{carTitle}</b> : <span className="muted">—</span>}
                    {r.vehicle_info && <div className="muted" style={{ fontSize: 13 }}>{r.vehicle_info}</div>}
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: 170 }}>
                    {r.driver_name || r.driver_code ? (
                      <>
                        <b>{r.driver_name || "—"}</b>
                        {r.driver_code && <span className="muted"> ({r.driver_code})</span>}
                        {r.driver_phone && (
                          <div style={{ fontSize: 13 }}>
                            <a href={`tel:${r.driver_phone}`}>📞 {r.driver_phone}</a>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="muted">ยังไม่ระบุ (<Link href="/trucks">เพิ่มข้อมูล</Link>)</span>
                    )}
                  </td>
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
              );
            })}
            {!rows.length && (
              <tr><td colSpan={8} className="muted">ยังไม่มีรถ — เพิ่มหรือนำเข้า Datasheet ที่หน้า <Link href="/trucks">จัดการรถ</Link></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
