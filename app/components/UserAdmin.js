"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_TH = {
  admin: "ผู้ดูแลระบบ (admin · จัดการทุกอย่าง)",
  manager: "หัวหน้างาน (manager · ปิดเคส & แก้ไขข้อมูลรถ)",
  viewer: "ผู้ดูข้อมูล (viewer · ดูแผนที่และรายงานอย่างเดียว)",
};

export default function UserAdmin({ users, currentUserId }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveUser(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const j = await r.json();
      if (j.ok) {
        setUsername("");
        setPassword("");
        setMsg(`✅ บันทึกผู้ใช้ ${j.username} (${j.role}) แล้ว`);
        router.refresh();
      } else {
        setMsg(`⚠️ ${j.error || "บันทึกไม่สำเร็จ"}`);
      }
    } catch {
      setMsg("⚠️ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setBusy(false);
  }

  // send a request; show the server's error (e.g. "ต้องมี admin อย่างน้อย 1 คน") instead of failing silently
  async function call(method, body) {
    try {
      const r = await fetch("/api/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) setMsg(`⚠️ ${j.error || "ทำไม่สำเร็จ"}`);
    } catch {
      setMsg("⚠️ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    router.refresh();
  }

  async function unlockUser(u) {
    await call("POST", { action: "unlock", id: u.id });
  }

  async function removeUser(u) {
    if (!window.confirm(`ลบบัญชีผู้ใช้ "${u.username}"?`)) return;
    await call("DELETE", { id: u.id });

  }

  return (
    <div className="card">
      <b style={{ display: "block", marginBottom: 6 }}>🔐 จัดการบัญชีผู้ใช้เว็บบริษัท 3 ระดับสิทธิ์ (admin / manager / viewer)</b>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        เพิ่มบัญชีสำหรับหัวหน้างานหรือเจ้าหน้าที่ดูแผนที่ (หากใส่ชื่อผู้ใช้เดิมจะเป็นการเปลี่ยนรหัสผ่านและระดับสิทธิ์)
      </div>
      <form onSubmit={saveUser} className="filters" style={{ alignItems: "center" }}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ชื่อผู้ใช้ (เช่น manager1)" required style={{ maxWidth: 190 }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)" minLength={8} required style={{ maxWidth: 210 }} />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            font: "inherit", padding: "9px 10px", borderRadius: 8,
            border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)",
          }}
        >
          <option value="manager">{ROLE_TH.manager}</option>
          <option value="viewer">{ROLE_TH.viewer}</option>
          <option value="admin">{ROLE_TH.admin}</option>
        </select>
        <button className="primary" disabled={busy}>➕ เพิ่ม / อัปเดตผู้ใช้</button>
        {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
      </form>

      <table>
        <thead>
          <tr><th>ชื่อผู้ใช้</th><th>ระดับสิทธิ์</th><th>สถานะบัญชี</th><th>จัดการ</th></tr>
        </thead>
        <tbody>
          {(users || []).map((u) => (
            <tr key={u.id}>
              <td><b>{u.username}</b> {u.id === currentUserId && <span className="muted">(คุณ)</span>}</td>
              <td>{ROLE_TH[u.role] || u.role}</td>
              <td>
                {u.locked ? <span className="pill l2">ถูกล็อก (ใส่รหัสผิดเกิน 5 ครั้ง)</span> : <span className="pill l0">ปกติ</span>}
              </td>
              <td style={{ display: "flex", gap: 6 }}>
                {u.locked && <button type="button" onClick={() => unlockUser(u)}>🔓 ปลดล็อก</button>}
                {u.id !== currentUserId && <button type="button" onClick={() => removeUser(u)}>🗑️ ลบ</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
