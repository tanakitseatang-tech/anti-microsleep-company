// C4: alert list with filters, vehicle & driver info, close a case.
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser, canManage } from "@/lib/auth";
import { LEVEL_TH, thTime } from "@/lib/format";
import CloseButton from "../components/CloseButton";
import AutoRefresh from "../components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function Alerts({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  await ensureTruckColumns();
  const show = searchParams?.show === "all" ? "all" : "open";
  const events = await sql`
    SELECT e.id, e.level, e.reasons, e.driver_code, e.happened_at, e.lat, e.lon, e.speed,
           e.closed_at, e.close_note,
           t.code AS truck, t.name AS truck_name, t.brand, t.model,
           t.driver_name AS t_driver_name, t.driver_code AS t_driver_code, t.driver_phone AS t_driver_phone,
           u.username AS closed_by
    FROM events e
    JOIN trucks t ON t.id = e.truck_id
    LEFT JOIN users u ON u.id = e.closed_by
    WHERE (${show}::text = 'all' OR e.closed_at IS NULL)
    ORDER BY e.happened_at DESC
    LIMIT 300`;

  return (
    <>
      <AutoRefresh seconds={30} />
      <h1>การแจ้งเตือน</h1>
      <div className="filters">
        <Link className="btn" href="/alerts">เคสที่ยังเปิด</Link>
        <Link className="btn" href="/alerts?show=all">ทั้งหมด (90 วันล่าสุด)</Link>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>เวลา</th><th>รถ / ยี่ห้อ</th><th>ผู้ขับรถ</th><th>ระดับ</th><th>สาเหตุ</th><th>ความเร็ว</th><th>ตำแหน่ง</th><th>เคส</th></tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const carSub = [e.truck_name, e.brand, e.model].filter(Boolean).join(" · ");
              const drvName = e.driver_code || [e.t_driver_name, e.t_driver_code ? `(${e.t_driver_code})` : ""].filter(Boolean).join(" ");
              return (
                <tr key={e.id}>
                  <td>{thTime(e.happened_at)}</td>
                  <td>
                    <b>คันที่ {e.truck}</b>
                    {carSub && <div className="muted" style={{ fontSize: 12 }}>{carSub}</div>}
                  </td>
                  <td>
                    {drvName || "—"}
                    {e.t_driver_phone && <div className="muted" style={{ fontSize: 12 }}>📞 {e.t_driver_phone}</div>}
                  </td>
                  <td><span className={`pill l${e.level}`}>{LEVEL_TH[e.level]}</span></td>
                  <td style={{ whiteSpace: "normal", minWidth: 180 }}>{(e.reasons || []).join(" · ") || "—"}</td>
                  <td>{e.speed == null ? "—" : `${Math.round(e.speed)} กม./ชม.`}</td>
                  <td>
                    {e.lat == null ? "—" : (
                      <a href={`https://www.google.com/maps?q=${e.lat},${e.lon}`} target="_blank" rel="noreferrer">แผนที่</a>
                    )}
                  </td>
                  <td>
                    {e.closed_at
                      ? <span className="muted">ปิดแล้ว ({e.closed_by || "คนขับ"}){e.close_note ? `: ${e.close_note}` : ""}</span>
                      : canManage(user) ? <CloseButton id={e.id} /> : <span className="muted">เปิดอยู่</span>}
                  </td>
                </tr>
              );
            })}
            {!events.length && <tr><td colSpan={8} className="muted">ไม่มีการแจ้งเตือน</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
