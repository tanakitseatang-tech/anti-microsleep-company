"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloseButton({ id }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        const note = window.prompt("บันทึกการปิดเคส (เช่น โทรหาคนขับแล้ว ให้พักที่ปั๊มถัดไป)", "");
        if (note === null) return;
        setBusy(true);
        try {
          const r = await fetch(`/api/alerts/${id}/close`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || j.ok === false) window.alert(j.error || "ปิดเคสไม่สำเร็จ (อาจหมดเวลาล็อกอิน ลองรีเฟรช)");
        } catch {
          window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        }
        setBusy(false);
        router.refresh();
      }}
    >
      ปิดเคส
    </button>
  );
}
