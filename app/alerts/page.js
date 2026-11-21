// C4 + C8: alert list with Thai reasons, Excel/CSV & PDF export, LINE switch, and case closing.
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser, canManage } from "@/lib/auth";
import { LEVEL_TH, thTime, thReasons } from "@/lib/format";
import CloseButton from "../components/CloseButton";
import CloseAllButton from "../components/CloseAllButton";
import AutoRefresh from "../components/AutoRefresh";
import LineTestButton from "../components/LineTestButton";
import AlertsExport from "../components/AlertsExport";
import ArchiveButton from "../components/ArchiveButton";
import { escalateFromPage } from "@/lib/escalatePage";

export const dynamic = "force-dynamic";

export default async function Alerts({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  await ensureTruckColumns();
  await escalateFromPage();
  const show = ["all", "archived"].includes(searchParams?.show) ? searchParams.show : "open";
  const events = await sql`
    SELECT e.id, e.level, e.reasons, e.driver_code, e.happened_at, e.lat, e.lon, e.speed,
           e.closed_at, e.close_note,
           t.code AS truck, t.name AS truck_name, t.brand, t.model,
           t.driver_name AS t_driver_name, t.driver_code AS t_driver_code, t.driver_phone AS t_driver_phone,
           u.username AS closed_by
    FROM events e
    JOIN trucks t ON t.id = e.truck_id
    LEFT JOIN users u ON u.id = e.closed_by
    WHERE (CASE ${show}::text WHEN 'archived' THEN e.archived
                WHEN 'all' THEN NOT e.archived
                ELSE NOT e.archived AND e.closed_at IS NULL END)
    ORDER BY e.happened_at DESC
    LIMIT 300`;
  const [{ open_count: openCount, archived_count: archivedCount }] = await sql`
    SELECT count(*) FILTER (WHERE closed_at IS NULL)::int AS open_count,
           count(*) FILTER (WHERE archived)::int AS archived_count FROM events`;

  const exportList = events.map((e) => {
    const carSub = [e.truck_name, e.brand, e.model].filter(Boolean).join(" · ");
    const drvName = e.driver_code || [e.t_driver_name, e.t_driver_code ? `(${e.t_driver_code})` : ""].filter(Boolean).join(" ");
    const statusTh = e.closed_at
      ? `ปิดแล้ว (${e.closed_by || "คนขับ"})${e.close_note ? `: ${e.close_note}` : ""}`
      : "เปิดอยู่";
    return {
      time_th: thTime(e.happened_at),
      truck: e.truck,
      car_sub: carSub,
      driver_label: drvName,
      phone: e.t_driver_phone,
      level_th: LEVEL_TH[e.level],
      reasons_th: thReasons(e.reasons),
      speed: e.speed,
      lat: e.lat,
      lon: e.lon,
      status_th: statusTh,
    };
  });

  return (
    <>
      <AutoRefresh seconds={30} />
      <h1>การแจ้งเตือน{show === "archived" ? " · ข้อมูลทดสอบที่ซ่อนไว้" : ""}</h1>
      <div className="filters" style={{ alignItems: "center" }}>
        <Link className="btn" href="/alerts">เคสที่ยังเปิด</Link>
        <Link className="btn" href="/alerts?show=all">ทั้งหมด (90 วันล่าสุด)</Link>
        <AlertsExport events={exportList} />
        {canManage(user) && <CloseAllButton count={openCount} />}
        {user.role === "admin" && <LineTestButton />}
        {user.role === "admin" && show !== "archived" && <ArchiveButton />}
        {archivedCount > 0 && <Link className="btn" href="/alerts?show=archived">🗂️ ข้อมูลทดสอบที่ซ่อน ({archivedCount})</Link>}
        {user.role === "admin" && show === "archived" && <ArchiveButton undo count={archivedCount} />}
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>เวลา</th><th>รถ / ยี่ห้อ</th><th>ผู้ขับรถ</th><th>ระดับ</th><th>สาเหตุ (ภาษาไทย)</th><th>ความเร็ว</th><th>ตำแหน่ง</th><th>เคส</th></tr>
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
                  <td style={{ whiteSpace: "normal", minWidth: 180 }}><b>{thReasons(e.reasons)}</b></td>
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
