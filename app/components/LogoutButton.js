"use client";
import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await fetch("/api/auth/logout", { method: "POST" });
          if (!r.ok) window.alert("ออกจากระบบไม่สำเร็จ (เซิร์ฟเวอร์ตอบกลับผิดพลาด) — กำลังไปหน้าเข้าสู่ระบบ");
        } catch {
          window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — กำลังไปหน้าเข้าสู่ระบบ (ถ้ายังเห็นข้อมูลอยู่ ให้ลองออกจากระบบอีกครั้งเมื่อเน็ตกลับมา)");
        } finally {
          // always leave this page, and never keep the button disabled
          setBusy(false);
          window.location.href = "/login";
        }
      }}
    >
      ออกจากระบบ
    </button>
  );
}
