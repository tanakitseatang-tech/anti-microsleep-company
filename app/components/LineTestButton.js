"use client";
import { useEffect, useState } from "react";

// Admin-only LINE panel: on/off switch, messages used this month, test message.
export default function LineTestButton() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/line/test", { cache: "no-store" });
      if (r.ok) setS(await r.json());
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function toggle() {
    const next = !s.enabled;
    if (!next && !window.confirm("ปิดการแจ้งเตือน LINE? ระบบจะไม่ส่ง LINE จนกว่าจะเปิดใหม่")) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/line/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await r.json();
      if (j.ok) setS({ ...s, enabled: j.enabled });
      else setMsg(j.error || "เปลี่ยนไม่สำเร็จ");
    } catch { setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/line/test", { method: "POST" });
      const j = await r.json();
      setMsg(j.ok ? "ส่งแล้ว ✓ ดูใน LINE" : `ส่งไม่สำเร็จ: ${j.error || r.status}`);
      load();
    } catch { setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    setBusy(false);
  }

  if (!s) return null;
  if (!s.configured) return <span className="muted" style={{ fontSize: 13 }}>LINE: ยังไม่ได้ตั้งค่า</span>;

  const q = s.quota;
  const quotaText = !q || q.used == null ? "ดูโควตาไม่ได้"
    : q.limit == null ? `ส่งไปแล้ว ${q.used} ข้อความเดือนนี้`
    : `ส่งไปแล้ว ${q.used} / ${q.limit} ข้อความเดือนนี้ (เหลือ ${Math.max(0, q.limit - q.used)})`;
  const low = q && q.limit != null && q.used != null && q.limit - q.used <= 20;

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={toggle} disabled={busy}
        className={s.enabled ? "primary" : undefined}
        title={`ส่ง LINE ถึง admin เมื่อคนขับไม่กด "ฉันตื่นแล้ว" ภายใน ${Math.round(s.waitS / 60)} นาที`}>
        LINE: {s.enabled ? "เปิด" : "ปิด"}
      </button>
      <span className="muted" style={{ fontSize: 13, color: low ? "var(--alarm)" : undefined }}>{quotaText}</span>
      {s.enabled && <button onClick={test} disabled={busy}>ทดสอบ LINE</button>}
      {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}
    </span>
  );
}
