"use client";
import { useEffect, useState } from "react";

// Admin-only: shows whether LINE alerts are set up and sends a test message.
export default function LineTestButton() {
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/line/test").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  async function test() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/line/test", { method: "POST" });
      const j = await r.json();
      setMsg(j.ok ? "ส่งแล้ว ✓ ดูใน LINE" : `ส่งไม่สำเร็จ: ${j.error || r.status}`);
    } catch {
      setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setBusy(false);
  }

  if (!status) return null;
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className="muted" style={{ fontSize: 13 }}>
        LINE: {status.configured ? (status.mode === "push" ? "เปิด (ส่งถึงผู้รับที่ตั้งไว้)" : "เปิด (ส่งถึงเพื่อนทุกคน)") : "ยังไม่ได้ตั้งค่า"}
      </span>
      {status.configured && <button onClick={test} disabled={busy}>ทดสอบ LINE</button>}
      {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}
    </span>
  );
}
