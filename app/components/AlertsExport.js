"use client";

// One CSV cell. Excel must never run a cell as a formula: look at the first NON-space character
// (" =cmd", "\n=cmd" are formulas too) and put an apostrophe in front of = + - @ (and a leading
// tab/CR). Plain negative numbers such as -12.5 stay numbers. Comma, quote, CR, LF -> quoted.
// (Same rule as TruckAdmin.js.)
function csvCell(v) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v !== "number") {
    const lead = s.replace(/^[\s ​﻿]+/, "");
    const plainNegative = /^-\d+(\.\d+)?$/.test(s.trim());
    if (/^[\t\r]/.test(s) || (/^[=+\-@]/.test(lead) && !plainNegative)) s = "'" + s;
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Phone as text: Excel turns 0812345678 into the number 812345678 (leading 0 lost). Writing it
// with dashes (081-234-5678) keeps it as text without any formula trick. Other formats stay as typed.
function phoneText(v) {
  const s = String(v ?? "").trim();
  if (/^0\d{9}$/.test(s)) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`; // mobile 08x-xxx-xxxx
  if (/^0\d{8}$/.test(s)) return `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`; // landline 02-xxx-xxxx
  return s;
}

export default function AlertsExport({ events }) {
  function exportCsv() {
    const headers = ["เวลา", "รหัสรถ", "ทะเบียน/ยี่ห้อ", "ผู้ขับรถ", "เบอร์โทร", "ระดับ", "สาเหตุ", "ความเร็ว (กม./ชม.)", "ละติจูด", "ลองจิจูด", "สถานะเคส"];
    const esc = csvCell;
    const rows = (events || []).map((e) => [
      e.time_th,
      e.truck,
      e.car_sub,
      e.driver_label,
      phoneText(e.phone),
      e.level_th,
      e.reasons_th,
      e.speed == null ? "" : Math.round(e.speed),
      e.lat ?? "",
      e.lon ?? "",
      e.status_th,
    ].map(esc).join(","));
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anti-microsleep-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={exportCsv}>📤 ส่งออก Excel (.csv)</button>
      <button type="button" onClick={() => window.print()}>🖨️ พิมพ์รายงาน / PDF</button>
    </span>
  );
}
