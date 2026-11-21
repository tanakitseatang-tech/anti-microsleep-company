"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Close every open case at once (admin/manager). Asks for confirmation and a short note.
export default function CloseAllButton({ count }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!count) return null;
  return (
    <button
      className="primary"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`ปิดเคสที่ยังเปิดอยู่ทั้งหมด ${count} เคส?`)) return;
        const note = window.prompt("บันทึกการปิดเคส (ใช้กับทุกเคส)", "ปิดเคสทดสอบ");
        if (note === null) return;
        setBusy(true);
        try {
          const r = await fetch("/api/alerts/close-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
          });
          const j = await r.json();
          if (!j.ok) window.alert(j.error || "ปิดเคสไม่สำเร็จ");
        } catch {
          window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        }
        setBusy(false);
        router.refresh();
      }}
    >
      ✅ ปิดเคสทั้งหมด ({count})
    </button>
  );
}
