"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin: hide all test cases so the demo starts clean (nothing is deleted; "undo" brings them back).
export default function ArchiveButton({ undo = false, count = 0 }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (undo && !count) return null;
  return (
    <button
      disabled={busy}
      onClick={async () => {
        const q = undo
          ? `แสดงข้อมูลทดสอบที่ซ่อนไว้กลับมาทั้งหมด ${count} เคส?`
          : "ซ่อนเคสทั้งหมดจนถึงตอนนี้เป็น \"ข้อมูลทดสอบ\"?\n\n• เคสที่ยังเปิดจะถูกปิด\n• ไม่ลบข้อมูล กดแสดงกลับได้ทีหลัง\n• ตัวเลขบนแผนที่และรายงานจะเริ่มนับใหม่";
        if (!window.confirm(q)) return;
        setBusy(true);
        try {
          const r = await fetch("/api/alerts/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ undo }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ok) window.alert(j.error || "ทำไม่สำเร็จ ลองใหม่อีกครั้ง");
          else window.alert(undo ? `แสดงกลับ ${j.restored} เคสแล้ว` : `ซ่อน ${j.archived} เคสแล้ว`);
        } catch {
          window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        }
        setBusy(false);
        router.refresh();
      }}
    >
      {undo ? `↩️ แสดงข้อมูลทดสอบกลับ (${count})` : "🧹 ซ่อนข้อมูลทดสอบ"}
    </button>
  );
}
