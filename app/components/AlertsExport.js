"use client";

// One CSV cell. Excel must never run a cell as a formula: look at the first NON-space character
// (" =cmd", "\n=cmd" are formulas too) and put an apostrophe in front of = + - @ (and a leading
// tab/CR). Plain negative numbers such as -12.5 stay numbers. Comma, quote, CR, LF -> quoted.
// (Same rule as TruckAdmin.js.) Shared with ReportsExport.js.
export function csvCell(v) {
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
// with dashes (081-234-5678) keeps it as text without any formula trick. Any all-digit value
// (spaces allowed) that starts with 0 gets dashes; values with a dash, a leading + or other
// characters stay exactly as typed.
export function phoneText(v) {
  const s = String(v ?? "").trim();
  if (!/^0[\d ]*$/.test(s)) return s;
  const d = s.replace(/ /g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`; // mobile 08x-xxx-xxxx
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`; // landline 02-xxx-xxxx
  // Short values: a dash right after the leading 0 ("0-1234"); month/day 0 is never a date in Excel.
  if (d.length <= 6) return d.length === 1 ? d : `0-${d.slice(1)}`;
  // Other lengths: groups of 3 digits, the last group keeps up to 4 (e.g. 012-345-67, 012-345-678-90).
  const parts = [];
  let rest = d;
  while (rest.length > 4) {
    parts.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  parts.push(rest);
  return parts.join("-");
}

// Build a UTF-8 (BOM) CSV with CRLF line endings and download it. Cells go through csvCell.
export function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AlertsExport({ events }) {
  function exportCsv() {
    const headers = ["เวลา", "รหัสรถ", "ทะเบียน/ยี่ห้อ", "ผู้ขับรถ", "เบอร์โทร", "ระดับ", "สาเหตุ", "ความเร็ว (กม./ชม.)", "ละติจูด", "ลองจิจูด", "สถานะเคส"];
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
    ]);
    downloadCsv(`anti-microsleep-alerts-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={exportCsv}>📤 ส่งออก Excel (.csv)</button>
      <button type="button" onClick={() => window.print()}>🖨️ พิมพ์รายงาน / PDF</button>
    </span>
  );
}
