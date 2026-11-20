"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TruckAdmin({ trucks }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [newKey, setNewKey] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: f.get("code"), name: f.get("name") }),
      });
      const j = await r.json();
      if (j.ok) { setNewKey({ code: j.code, key: j.key }); form.reset(); router.refresh(); }
      else setMsg(j.error || "เพิ่มไม่สำเร็จ");
    } catch { setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    setBusy(false);
  }

  async function revoke(t) {
    if (!window.confirm(`ยกเลิก API key ของรถ ${t.code}? บอร์ดคันนี้จะส่งข้อมูลไม่ได้จนกว่าจะออก key ใหม่`)) return;
    await fetch(`/api/trucks/${t.id}/revoke`, { method: "POST" });
    router.refresh();
  }

  return (
    <>
      <div className="card">
        <form onSubmit={add} className="filters" style={{ alignItems: "center", marginBottom: 0 }}>
          <input name="code" placeholder="รหัสรถ เช่น 7" required maxLength={20} style={{ maxWidth: 160 }} />
          <input name="name" placeholder="ชื่อ/ทะเบียน (ไม่บังคับ)" maxLength={60} style={{ maxWidth: 260 }} />
          <button className="primary" disabled={busy}>เพิ่มรถ / ออก key ใหม่</button>
          <span className="err">{msg}</span>
        </form>
      </div>

      {newKey && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <b>API key ของรถ {newKey.code}</b> — แสดงครั้งเดียว คัดลอกเก็บไว้ตอนนี้
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", userSelect: "all" }}>{newKey.key}</pre>
          <div className="muted">ใส่บนบอร์ดของรถคันนี้ที่ไฟล์ ~/ArduinoApps/anti-microsleep/company_api_key.txt</div>
          <button onClick={() => setNewKey(null)} style={{ marginTop: 8 }}>ซ่อน</button>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>รถ</th><th>ชื่อ</th><th>สถานะ key</th><th>ติดต่อล่าสุด</th><th>เวอร์ชัน</th><th></th></tr></thead>
          <tbody>
            {trucks.map((t) => (
              <tr key={t.id}>
                <td><b>{t.code}</b></td>
                <td>{t.name || "—"}</td>
                <td>{t.revoked ? <span className="pill off">ยกเลิกแล้ว</span> : <span className="pill l0">ใช้งาน</span>}</td>
                <td>{t.online ? "ออนไลน์" : t.seen}</td>
                <td>{t.version || "—"}</td>
                <td>{!t.revoked && <button onClick={() => revoke(t)}>ยกเลิก key</button>}</td>
              </tr>
            ))}
            {!trucks.length && <tr><td colSpan={6} className="muted">ยังไม่มีรถ</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
