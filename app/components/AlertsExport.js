"use client";

export default function AlertsExport({ events }) {
  function exportCsv() {
    const headers = ["เวลา", "รหัสรถ", "ทะเบียน/ยี่ห้อ", "ผู้ขับรถ", "เบอร์โทร", "ระดับ", "สาเหตุ", "ความเร็ว (กม./ชม.)", "ละติจูด", "ลองจิจูด", "สถานะเคส"];
    const esc = (v) => {
      let s = String(v ?? "");
      if (/^[=+@\t\r]/.test(s) || /^-[^\d]/.test(s)) s = "'" + s;   // Excel must not run it as a formula (negative numbers stay numbers)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = (events || []).map((e) => [
      e.time_th,
      e.truck,
      e.car_sub,
      e.driver_label,
      e.phone || "",
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
