// C5 + C6: Driver & Vehicle Safety Analytics, Safety Score (0-100), 24h Peak Drowsiness Chart, and Risk Heatmap.
import { redirect } from "next/navigation";
import { sql, ensureTruckColumns } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { thTime, thReason, thReasons } from "@/lib/format";
import ReportMap from "../components/ReportMap";
import ReportsExport from "../components/ReportsExport";

export const dynamic = "force-dynamic";

// Map/charts use at most this many newest events; the scorecard uses a full aggregate query.
const EVENT_CAP = 400;

// Safety score: deduct 12 pts per red alarm, 3 pts per yellow warning (min 0, max 100).
function safetyScore(t) {
  return Math.max(0, 100 - t.alarm_count * 12 - t.warn_count * 3);
}

// One chart bar per cause: drop the numbers so "หาว 3 ครั้งใน 5 นาที" and "หาว 4 ครั้งใน 5 นาที"
// (or "หลับใน 1.2 วินาที" / "หลับใน 2.5 วินาที") count as the same cause. Uses thReason() output.
function causeKey(th) {
  const k = String(th || "")
    .replace(/\s*\([^)]*\)/g, "") // "(PERCLOS 45%)", "(80% ใน 2 วิ)", "(กล้องมืด/ถูกบัง)"
    // "ใน 5 นาที" (time window). Minutes/hours only, so "หลับใน 1.2 วินาที" keeps its "ใน".
    .replace(/\s*ใน\s*\d[\d.,]*\s*(?:นาที|ชั่วโมง|ชม\.?)/g, "")
    .replace(/\d[\d.,]*\s*(?:วินาที|วิ\.?|ครั้ง|นาที|ชั่วโมง|ชม\.?|%|sec\b|s\b|min\b)?/gi, "") // "3 ครั้ง", "1.2 วินาที", "45%", "3s"
    .replace(/\s+/g, " ")
    .trim();
  return k || String(th || "").trim() || "อื่น ๆ";
}

export default async function ReportsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  await ensureTruckColumns();

  const trucks = await sql`
    SELECT t.id, t.code, t.name, t.brand, t.model, t.vehicle_info,
           t.driver_code, t.driver_name, t.driver_phone,
           count(e.id)::int AS total_events,
           count(e.id) FILTER (WHERE e.level = 1)::int AS warn_count,
           count(e.id) FILTER (WHERE e.level = 2)::int AS alarm_count,
           count(e.id) FILTER (WHERE e.closed_at IS NOT NULL)::int AS closed_count,
           count(e.id) FILTER (WHERE e.closed_at IS NULL)::int AS open_count
    FROM trucks t
    LEFT JOIN events e ON e.truck_id = t.id AND NOT e.archived
    WHERE t.key_revoked = false
    GROUP BY t.id
    ORDER BY alarm_count DESC, warn_count DESC, t.code ASC`;

  // Fetch one extra row only to detect whether the cap was hit.
  const eventRows = await sql`
    SELECT e.id, e.level, e.reasons, e.happened_at, e.lat, e.lon, e.close_note,
           t.code AS truck, t.driver_name, t.driver_code
    FROM events e
    JOIN trucks t ON t.id = e.truck_id
    WHERE NOT e.archived AND t.key_revoked = false
    ORDER BY e.happened_at DESC
    LIMIT ${EVENT_CAP + 1}`;
  const eventsCapped = eventRows.length > EVENT_CAP;
  const events = Array.from(eventRows).slice(0, EVENT_CAP);

  // 24-hour distribution in Asia/Bangkok time
  const hours = Array(24).fill(0);
  const causeCounts = {};
  let totalRespSec = 0, respCount = 0;

  for (const e of events) {
    if (e.happened_at) {
      const hr = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Bangkok",
          hour: "numeric",
          hour12: false,
        }).format(new Date(e.happened_at))
      ) % 24;
      if (!Number.isNaN(hr)) hours[hr]++;
    }
    for (const r of e.reasons || []) {
      // Group by generic Thai reason category
      const th = causeKey(thReason(r));
      causeCounts[th] = (causeCounts[th] || 0) + 1;
    }
    const m = String(e.close_note || "").match(/ตอบสนองใน\s*(\d+)\s*วิ/);
    if (m) {
      totalRespSec += Number(m[1]);
      respCount++;
    }
  }

  const maxHour = Math.max(1, ...hours);
  const topCauses = Object.entries(causeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCause = Math.max(1, ...(topCauses.map((c) => c[1])));
  const avgResp = respCount > 0 ? Math.round(totalRespSec / respCount) : null;

  const heatPoints = events
    .filter((e) => e.lat != null && e.lon != null)
    .map((e) => ({
      lat: e.lat,
      lon: e.lon,
      level: e.level,
      truck: e.truck,
      driver: [e.driver_name, e.driver_code ? `(${e.driver_code})` : ""].filter(Boolean).join(" "),
      reason: thReasons(e.reasons),
      time: thTime(e.happened_at),
      ts: new Date(e.happened_at).getTime() || 0, // for newest-first sorting in the map popup
    }));

  const totalAlarms = trucks.reduce((s, t) => s + t.alarm_count, 0);
  const totalWarns = trucks.reduce((s, t) => s + t.warn_count, 0);

  // Plain rows for the CSV export (same score as the table below).
  const scoreRows = trucks.map((t) => ({
    code: t.code ?? "",
    plate: t.name ?? "",
    brand_model: [t.brand, t.model].filter(Boolean).join(" "),
    driver_name: t.driver_name ?? "",
    driver_code: t.driver_code ?? "",
    driver_phone: t.driver_phone ?? "",
    score: safetyScore(t),
    warn_count: t.warn_count,
    alarm_count: t.alarm_count,
    closed_count: t.closed_count,
    open_count: t.open_count,
  }));

  return (
    <>
      <h1>📊 รายงานวิเคราะห์ความปลอดภัย & Heatmap จุดเสี่ยง</h1>

      <div style={{ marginBottom: 12 }}>
        <ReportsExport rows={scoreRows} />
      </div>

      {eventsCapped && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          ℹ️ แผนที่ กราฟ และเวลากดตื่นเฉลี่ย ใช้ {EVENT_CAP} เหตุการณ์ล่าสุด · จำนวนเหตุการณ์ (เหลือง/แดง) และตารางคะแนนความปลอดภัยนับจากเหตุการณ์ทั้งหมดครบถ้วน
        </div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="k">เหตุการณ์สะสมทั้งหมด</div>
          <div className="v">{totalAlarms + totalWarns}</div>
        </div>
        <div className="tile">
          <div className="k">เตือนเริ่มง่วง (เหลือง)</div>
          <div className="v" style={{ color: "var(--warn)" }}>{totalWarns}</div>
        </div>
        <div className="tile">
          <div className="k">หลับในอันตราย (แดง)</div>
          <div className="v" style={{ color: "var(--alarm)" }}>{totalAlarms}</div>
        </div>
        <div className="tile">
          <div className="k">เวลาคนขับกดตื่นเฉลี่ย</div>
          <div className="v">{avgResp != null ? `${avgResp} วิ` : "—"}</div>
        </div>
      </div>

      {/* C6: Drowsiness Danger-Zone Heatmap */}
      <div className="card">
        <b style={{ display: "block", marginBottom: 6 }}>
          🗺️ แผนที่จุดเสี่ยงความง่วง (Drowsiness Risk Heatmap · {heatPoints.length} จุด)
        </b>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          วงกลมสีแดง = จุดที่เกิดการหลับใน (ระดับแดง) · วงกลมสีส้ม = จุดที่เริ่มมีอาการง่วง (ระดับเหลือง) · วงยิ่งใหญ่ = ยิ่งเกิดซ้ำหลายเคสที่จุดเดียวกัน · คลิกที่จุดเพื่อดูคนขับและสาเหตุ
        </div>
        <ReportMap points={heatPoints} />
      </div>

      {/* 24-Hour Peak Drowsiness & Cause Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <div className="card">
          <b style={{ display: "block", marginBottom: 10 }}>⏰ ช่วงเวลาที่คนขับง่วงบ่อยที่สุด (24 ชั่วโมง)</b>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 4, alignItems: "end", height: 130, paddingTop: 16 }}>
            {hours.map((cnt, h) => {
              const pct = Math.round((cnt / maxHour) * 100);
              return (
                <div key={h} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${h}:00 น. — ${cnt} ครั้ง`}>
                  <span style={{ fontSize: 10 }} className="muted">{cnt || ""}</span>
                  <div style={{ width: "100%", height: 85, display: "flex", alignItems: "flex-end", background: "rgba(128,128,128,0.1)", borderRadius: 4 }}>
                    <div
                      style={{
                        width: "100%",
                        height: `${cnt ? Math.max(12, pct) : 0}%`,
                        background: cnt > maxHour * 0.6 ? "var(--alarm)" : "var(--accent)",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 10 }} className="muted">{h}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <b style={{ display: "block", marginBottom: 10 }}>🔍 สาเหตุอาการง่วงที่พบบ่อยที่สุด</b>
          {topCauses.map(([cause, cnt]) => (
            <div key={cause} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                <b>{cause}</b>
                <span className="muted">{cnt} ครั้ง</span>
              </div>
              <div style={{ height: 8, background: "rgba(128,128,128,0.15)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((cnt / maxCause) * 100)}%`, height: "100%", background: "var(--warn)" }} />
              </div>
            </div>
          ))}
          {!topCauses.length && <div className="muted">ยังไม่มีข้อมูลการแจ้งเตือน</div>}
        </div>
      </div>

      {/* C5: Driver & Truck Safety Scorecard */}
      <div className="card">
        <b style={{ display: "block", marginBottom: 10 }}>🏆 ตารางคะแนนความปลอดภัยรายคนขับและรถ (Driver & Vehicle Safety Score)</b>
        <table>
          <thead>
            <tr>
              <th>รถ / ทะเบียน</th>
              <th>ยี่ห้อ / ข้อมูลรถ</th>
              <th>ผู้ขับรถ (พนักงาน)</th>
              <th>คะแนนความปลอดภัย</th>
              <th>🟡 เตือน</th>
              <th>🔴 อันตราย</th>
              <th>ยืนยัน/ปิดเคสแล้ว</th>
              <th>เคสค้าง</th>
            </tr>
          </thead>
          <tbody>
            {trucks.map((t) => {
              const score = safetyScore(t);
              const scoreLevel = score >= 80 ? "l0" : score >= 55 ? "l1" : "l2";
              return (
                <tr key={t.id}>
                  <td>
                    <b>คันที่ {t.code}</b>
                    {t.name && <div className="muted" style={{ fontSize: 12 }}>{t.name}</div>}
                  </td>
                  <td>
                    <b>{[t.brand, t.model].filter(Boolean).join(" ") || "—"}</b>
                    {t.vehicle_info && <div className="muted" style={{ fontSize: 12 }}>{t.vehicle_info}</div>}
                  </td>
                  <td>
                    <b>{t.driver_name || "—"}</b>
                    {t.driver_code && <span className="muted"> ({t.driver_code})</span>}
                    {t.driver_phone && <div className="muted" style={{ fontSize: 12 }}>📞 {t.driver_phone}</div>}
                  </td>
                  <td><span className={`pill ${scoreLevel}`}>{score} / 100</span></td>
                  <td>{t.warn_count}</td>
                  <td><b style={{ color: t.alarm_count ? "var(--alarm)" : undefined }}>{t.alarm_count}</b></td>
                  <td>{t.closed_count}</td>
                  <td>{t.open_count || "—"}</td>
                </tr>
              );
            })}
            {!trucks.length && <tr><td colSpan={8} className="muted">ยังไม่มีข้อมูลรถ</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
