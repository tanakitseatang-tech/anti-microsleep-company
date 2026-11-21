"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_DRIVERS = [
  { code: "001", name: "สมชาย ใจดี", phone: "0XX-XXX-XXXX" },
  { code: "002", name: "วิชัย สายชล", phone: "0XX-XXX-XXXX" },
  { code: "003", name: "กิตติพงศ์ ทองดี", phone: "0XX-XXX-XXXX" },
];

export default function DriverAdmin({ drivers }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, phone }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "บันทึกไม่สำเร็จ"); return; }
      setCode(""); setName(""); setPhone("");
      setMsg(`บันทึกรหัส ${d.driver?.code} (${d.driver?.name}) เรียบร้อยแล้ว`);
      router.refresh();
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  async function loadSamples() {
    // never overwrite a real driver (001–003 may already be real people)
    const have = new Set((drivers || []).map((d) => String(d.code)));
    const rows = SAMPLE_DRIVERS.filter((d) => !have.has(d.code));
    if (!rows.length) { setErr("มีรหัส 001–003 อยู่แล้ว ไม่ใส่ตัวอย่างทับข้อมูลจริง"); return; }
    if (!confirm(`เพิ่มพนักงานตัวอย่าง ${rows.length} คน (รหัส ${rows.map((d) => d.code).join(", ")})?`)) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "เพิ่มตัวอย่างไม่สำเร็จ"); return; }
      setMsg(`เพิ่มรายชื่อพนักงานตัวอย่าง ${d.imported} คนแล้ว`);
      router.refresh();
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c) {
    if (!confirm(`ลบพนักงานรหัส ${c} ออกจากระบบ?`)) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/drivers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      if (!r.ok) { setErr("ลบไม่สำเร็จ"); return; }
      setMsg(`ลบรหัส ${c} แล้ว`);
      router.refresh();
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>👨‍✈️ รายชื่อพนักงานขับรถ (รหัส 3 หลัก)</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            คนขับแค่กรอกรหัส 3 หลัก (เช่น <b>001</b>) ตอนเริ่มกะบนหน้าคนขับ เว็บบริษัทจะดึงชื่อและเบอร์โทรมาแสดงให้อัตโนมัติ
          </div>
        </div>
        <button type="button" className="btn" disabled={busy} onClick={loadSamples}>
          ⚡ ใส่ตัวอย่าง 3 คน (001–003)
        </button>
      </div>

      <form onSubmit={save} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12 }} className="muted">รหัส 3 หลัก</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="001"
            maxLength={10}
            required
            style={{ width: 96 }}
          />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ display: "block", fontSize: 12 }} className="muted">ชื่อ-นามสกุล</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="สมชาย ใจดี"
            required
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label style={{ display: "block", fontSize: 12 }} className="muted">เบอร์โทร (เว้นว่าง = ลบเบอร์เดิม)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="081-234-5678"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="btn primary" disabled={busy}>
          + บันทึกพนักงาน
        </button>
      </form>

      {msg && <div style={{ color: "#15803d", fontSize: 13, marginBottom: 8 }}>✅ {msg}</div>}
      {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>⚠️ {err}</div>}

      <table>
        <thead>
          <tr>
            <th style={{ width: 100 }}>รหัส</th>
            <th>ชื่อ-นามสกุล</th>
            <th>เบอร์โทร</th>
            <th style={{ width: 140 }}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.code}>
              <td><b>{d.code}</b></td>
              <td>{d.name}</td>
              <td>{d.phone || <span className="muted">—</span>}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                  onClick={() => { setCode(d.code); setName(d.name); setPhone(d.phone || ""); }}
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                  disabled={busy}
                  onClick={() => remove(d.code)}
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
          {!drivers.length && (
            <tr>
              <td colSpan={4} className="muted">
                ยังไม่มีรายชื่อพนักงาน — เพิ่มด้านบน หรือกดปุ่ม <b>ใส่ตัวอย่าง 3 คน (001–003)</b>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
