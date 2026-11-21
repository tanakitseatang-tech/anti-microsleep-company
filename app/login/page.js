"use client";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);   // show "first-time setup" only while it is possible
  useEffect(() => {
    fetch("/api/setup").then((r) => r.json()).then((j) => setSetupOpen(!!j.open)).catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: f.get("username"), password: f.get("password") }),
      });
      const j = await r.json();
      if (j.ok) window.location.href = "/";
      else setErr(j.error || "เข้าสู่ระบบไม่สำเร็จ");
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setBusy(false);
  }

  return (
    <form className="login" onSubmit={onSubmit}>
      <h1>😴 Anti-Microsleep · บริษัท</h1>
      <input name="username" placeholder="ชื่อผู้ใช้" autoComplete="username" required />
      <input name="password" type="password" placeholder="รหัสผ่าน" autoComplete="current-password" required />
      <button className="primary" disabled={busy}>{busy ? "กำลังเข้า…" : "เข้าสู่ระบบ"}</button>
      <div className="err">{err}</div>
      {setupOpen && <a className="muted" href="/setup" style={{ fontSize: 13 }}>ติดตั้งใหม่? ตั้งค่าครั้งแรก</a>}
    </form>
  );
}
