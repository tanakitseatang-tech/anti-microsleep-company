"use client";
import { useEffect, useState } from "react";

// First-time setup: create the database tables and the first admin account.
export default function SetupPage() {
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/setup").then((r) => r.json()).then((j) => setOpen(j.open)).catch(() => setOpen(true));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) { setErr("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: f.get("username"), password: f.get("password") }),
      });
      const j = await r.json();
      if (j.ok) window.location.href = "/trucks";
      else setErr(j.error || "ตั้งค่าไม่สำเร็จ");
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setBusy(false);
  }

  if (open === null) return <p className="muted">กำลังตรวจสอบ…</p>;
  if (!open) {
    return (
      <div className="login">
        <h1>ตั้งค่าเรียบร้อยแล้ว</h1>
        <a className="btn" href="/login">ไปหน้าเข้าสู่ระบบ</a>
      </div>
    );
  }
  return (
    <form className="login" onSubmit={onSubmit}>
      <h1>ตั้งค่าครั้งแรก</h1>
      <p className="muted">สร้างตารางในฐานข้อมูล และบัญชีผู้ดูแล (admin) คนแรก หน้านี้ใช้ได้ครั้งเดียว</p>
      <input name="username" placeholder="ชื่อผู้ใช้ เช่น admin" autoComplete="username" required />
      <input name="password" type="password" placeholder="รหัสผ่าน (อย่างน้อย 10 ตัว)" autoComplete="new-password" minLength={10} required />
      <input name="password2" type="password" placeholder="ยืนยันรหัสผ่าน" autoComplete="new-password" minLength={10} required />
      <button className="primary" disabled={busy}>{busy ? "กำลังตั้งค่า…" : "สร้างบัญชีผู้ดูแล"}</button>
      <div className="err">{err}</div>
    </form>
  );
}
