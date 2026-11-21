"use client";
import { downloadCsv, phoneText } from "./AlertsExport";

// Export the driver & truck safety scorecard (rows already computed on the server page)
// as an Excel-friendly CSV, or print the report / save as PDF.
export default function ReportsExport({ rows }) {
  function exportCsv() {
    const headers = ["รหัสรถ", "ทะเบียน", "ยี่ห้อ/รุ่น", "คนขับ", "รหัสคนขับ", "เบอร์โทร", "คะแนนความปลอดภัย", "เตือน(เหลือง)", "อันตราย(แดง)", "ปิดเคสแล้ว", "เคสค้าง"];
    const data = (rows || []).map((r) => [
      r.code,
      r.plate,
      r.brand_model,
      r.driver_name,
      r.driver_code,
      phoneText(r.driver_phone),
      r.score,
      r.warn_count,
      r.alarm_count,
      r.closed_count,
      r.open_count,
    ]);
    downloadCsv(`anti-microsleep-safety-score-${new Date().toISOString().slice(0, 10)}.csv`, headers, data);
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={exportCsv}>📤 ส่งออก Excel (.csv)</button>
      <button type="button" onClick={() => window.print()}>🖨️ พิมพ์รายงาน / PDF</button>
    </span>
  );
}
