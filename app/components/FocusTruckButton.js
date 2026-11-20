"use client";

export default function FocusTruckButton({ code, hasCoords }) {
  if (!hasCoords) return <span className="muted">—</span>;
  return (
    <button
      type="button"
      onClick={() => window.__focusTruck && window.__focusTruck(code)}
      style={{ padding: "3px 9px", fontSize: 12 }}
      title="ซูมแผนที่ไปที่รถคันนี้"
    >
      🎯 ซูมดูรถ
    </button>
  );
}
