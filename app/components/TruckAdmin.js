"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE_ROWS = [
  {
    code: "1",
    name: "1กข-4582 กทม.",
    brand: "Isuzu",
    model: "ELF NMR 130",
    vehicle_info: "รถบรรทุก 6 ล้อตู้ทึบ",
    driver_code: "EMP001",
    driver_name: "สมชาย ใจดี",
    driver_phone: "081-234-5678",
  },
  {
    code: "2",
    name: "70-8912 ชลบุรี",
    brand: "Hino",
    model: "300 Innovator",
    vehicle_info: "รถบรรทุก 6 ล้อห้องเย็น",
    driver_code: "EMP002",
    driver_name: "วิชัย สายชล",
    driver_phone: "089-876-5432",
  },
  {
    code: "3",
    name: "3ฒณ-1120 กทม.",
    brand: "Toyota",
    model: "Hilux Revo",
    vehicle_info: "กระบะตู้ทึบส่งด่วน",
    driver_code: "EMP003",
    driver_name: "กิตติพงศ์ ทองดี",
    driver_phone: "086-555-4321",
  },
];

// Split a CSV or TSV line respecting double quotes
function splitLine(line, delim) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

const HEADER_MAP = [
  ["code", ["code", "truck", "truck_id", "id", "รหัสรถ", "หมายเลขรถ", "คันที่", "รถ", "เบอร์รถ"]],
  ["name", ["name", "plate", "license", "licence", "ทะเบียน", "ทะเบียนรถ", "ป้ายทะเบียน"]],
  ["brand", ["brand", "make", "ยี่ห้อ", "ยี่ห้อรถ", "แบรนด์"]],
  ["model", ["model", "รุ่น", "รุ่นรถ"]],
  ["vehicle_info", ["vehicle_info", "type", "info", "detail", "ข้อมูลรถ", "ประเภทรถ", "รายละเอียดรถ", "ลักษณะรถ"]],
  ["driver_code", ["driver_code", "emp_id", "employee_id", "emp", "รหัสพนักงาน", "รหัสคนขับ", "ไอดีพนักงาน"]],
  ["driver_name", ["driver_name", "driver", "employee", "fullname", "ชื่อคนขับ", "ชื่อผู้ขับ", "ชื่อพนักงาน", "ผู้ขับรถ", "คนขับ", "ชื่อ-นามสกุล", "ชื่อ"]],
  ["driver_phone", ["driver_phone", "phone", "tel", "mobile", "เบอร์โทร", "เบอร์โทรศัพท์", "โทรศัพท์", "เบอร์คนขับ"]],
];

function matchHeader(h) {
  const clean = h.toLowerCase().replace(/[\s_-]+/g, "");
  for (const [field, aliases] of HEADER_MAP) {
    for (const a of aliases) {
      if (clean === a.toLowerCase().replace(/[\s_-]+/g, "")) return field;
    }
  }
  return null;
}

function parseDatasheet(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const firstCells = splitLine(lines[0], delim);
  const mapped = firstCells.map(matchHeader);
  const hasHeader = mapped.some(Boolean);

  const defaultOrder = ["code", "name", "brand", "model", "vehicle_info", "driver_code", "driver_name", "driver_phone"];
  const cols = hasHeader ? mapped : defaultOrder;
  const startIdx = hasHeader ? 1 : 0;

  const rows = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    if (!cells.some(Boolean)) continue;
    const obj = {};
    for (let c = 0; c < cells.length; c++) {
      const field = cols[c] || defaultOrder[c];
      if (field && cells[c]) obj[field] = cells[c];
    }
    if (!obj.code) obj.code = String(rows.length + 1);
    rows.push(obj);
  }
  return rows;
}

function toCsv(rows) {
  const headers = ["รหัสรถ", "ทะเบียนรถ", "ยี่ห้อรถ", "รุ่นรถ", "ข้อมูลรถ", "รหัสพนักงาน", "ชื่อคนขับ", "เบอร์โทร"];
  const fields = ["code", "name", "brand", "model", "vehicle_info", "driver_code", "driver_name", "driver_phone"];
  const escCsv = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => fields.map((f) => escCsv(r[f])).join(","));
  return "\uFEFF" + [headers.join(","), ...body].join("\r\n");
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = {
  code: "", name: "", brand: "", model: "", vehicle_info: "",
  driver_code: "", driver_name: "", driver_phone: "",
};

export default function TruckAdmin({ trucks }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheetText, setSheetText] = useState("");
  const [search, setSearch] = useState("");

  const previewRows = sheetText.trim() ? parseDatasheet(sheetText) : [];

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function saveSingle(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setOkMsg("");
    try {
      const r = await fetch("/api/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.ok) {
        setOkMsg(`บันทึกข้อมูลรถคันที่ ${j.code} เรียบร้อยแล้ว`);
        setForm(EMPTY_FORM);
        router.refresh();
      } else {
        setMsg(j.error || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setBusy(false);
  }

  async function importRows(rowsToImport) {
    if (!rowsToImport.length) {
      setMsg("ไม่พบข้อมูลที่จะนำเข้า");
      return;
    }
    setBusy(true);
    setMsg("");
    setOkMsg("");
    try {
      const r = await fetch("/api/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToImport }),
      });
      const j = await r.json();
      if (j.ok) {
        setOkMsg(`นำเข้า Datasheet สำเร็จ ${j.imported} คัน/คน` + (j.skipped ? ` (ข้าม ${j.skipped} แถว)` : ""));
        setSheetText("");
        router.refresh();
      } else {
        setMsg(j.error || "นำเข้าไม่สำเร็จ");
      }
    } catch {
      setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setBusy(false);
  }

  async function onFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    // If file was saved from Thai Excel in TIS-620 / Windows-874, decode with windows-874
    if (text.includes("\uFFFD")) {
      try { text = new TextDecoder("windows-874").decode(buf); } catch {}
    }
    setSheetText(text);
    e.target.value = "";
  }

  function editRow(t) {
    setForm({
      code: t.code || "",
      name: t.name || "",
      brand: t.brand || "",
      model: t.model || "",
      vehicle_info: t.vehicle_info || "",
      driver_code: t.driver_code || "",
      driver_name: t.driver_name || "",
      driver_phone: t.driver_phone || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteRow(t) {
    if (!window.confirm(`ลบข้อมูลรถคันที่ ${t.code} (${t.driver_name || t.name || "ไม่มีชื่อ"})?`)) return;
    await fetch("/api/trucks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id }),
    });
    router.refresh();
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? trucks.filter((t) =>
        [t.code, t.name, t.brand, t.model, t.vehicle_info, t.driver_code, t.driver_name, t.driver_phone]
          .some((v) => String(v || "").toLowerCase().includes(q))
      )
    : trucks;

  return (
    <>
      {okMsg && (
        <div className="card" style={{ borderColor: "var(--ok)", color: "var(--ok)", fontWeight: 700 }}>
          ✅ {okMsg}
        </div>
      )}
      {msg && (
        <div className="card" style={{ borderColor: "var(--alarm)", color: "var(--alarm)", fontWeight: 700 }}>
          ⚠️ {msg}
        </div>
      )}

      {/* 1. Bulk Datasheet Import (Excel / CSV / Copy-Paste) */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <div>
            <b>📂 ดึง Datasheet พนักงานและรถหลายคนเข้าเว็บพร้อมกัน (Excel / CSV / Google Sheets)</b>
            <div className="muted" style={{ fontSize: 13 }}>
              อัปโหลดไฟล์ .csv จาก Excel หรือคัดลอกตาราง (Copy & Paste) จาก Excel / Google Sheets มาวางด้านล่างได้เลย
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => downloadFile("datasheet-template.csv", toCsv(SAMPLE_ROWS))}>
              📥 ดาวน์โหลดไฟล์ตัวอย่าง (.csv)
            </button>
            <button type="button" onClick={() => downloadFile("anti-microsleep-datasheet.csv", toCsv(trucks))}>
              📤 ส่งออกข้อมูลทั้งหมด (.csv)
            </button>
            <button type="button" onClick={() => importRows(SAMPLE_ROWS)} disabled={busy}>
              ✨ ใส่ข้อมูลตัวอย่าง 3 คันทันที
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <label className="btn" style={{ cursor: "pointer" }}>
            📄 เลือกไฟล์ Datasheet (.csv / .tsv / .txt)
            <input type="file" accept=".csv,.tsv,.txt" onChange={onFileSelect} style={{ display: "none" }} />
          </label>
          <span className="muted" style={{ fontSize: 13 }}>
            คอลัมน์ที่รองรับ: <code>รหัสรถ, ทะเบียนรถ, ยี่ห้อรถ, รุ่นรถ, ข้อมูลรถ, รหัสพนักงาน, ชื่อคนขับ, เบอร์โทร</code>
          </span>
        </div>

        <textarea
          value={sheetText}
          onChange={(e) => setSheetText(e.target.value)}
          rows={4}
          placeholder={
            "วางข้อมูลที่ Copy จาก Excel / Google Sheets หรือไฟล์ CSV ที่นี่ เช่น:\n" +
            "รหัสรถ,ทะเบียนรถ,ยี่ห้อรถ,รุ่นรถ,ข้อมูลรถ,รหัสพนักงาน,ชื่อคนขับ,เบอร์โทร\n" +
            "1,1กข-4582 กทม.,Isuzu,ELF NMR 130,รถบรรทุก 6 ล้อตู้ทึบ,EMP001,สมชาย ใจดี,081-234-5678"
          }
          style={{
            width: "100%", font: "13px/1.4 monospace", padding: 10, borderRadius: 8,
            border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)",
          }}
        />

        {previewRows.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <b>ตัวอย่างข้อมูลที่จะนำเข้า ({previewRows.length} แถว)</b>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="primary" onClick={() => importRows(previewRows)} disabled={busy}>
                  🚀 นำเข้าข้อมูลทั้งหมด ({previewRows.length} แถว)
                </button>
                <button type="button" onClick={() => setSheetText("")}>ล้าง</button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>รหัสรถ</th><th>ทะเบียน</th><th>ยี่ห้อ</th><th>รุ่น</th><th>ข้อมูลรถ</th><th>รหัสพนักงาน</th><th>ชื่อคนขับ</th><th>เบอร์โทร</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 10).map((r, idx) => (
                  <tr key={idx}>
                    <td><b>{r.code}</b></td>
                    <td>{r.name || "—"}</td>
                    <td>{r.brand || "—"}</td>
                    <td>{r.model || "—"}</td>
                    <td>{r.vehicle_info || "—"}</td>
                    <td>{r.driver_code || "—"}</td>
                    <td><b>{r.driver_name || "—"}</b></td>
                    <td>{r.driver_phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Single Truck & Driver Add/Edit Form */}
      <div className="card">
        <b style={{ display: "block", marginBottom: 8 }}>
          ✏️ เพิ่ม / แก้ไขข้อมูลรถและผู้ขับรายคัน {form.code ? `(กำลังแก้ไขคันที่ ${form.code})` : ""}
        </b>
        <form onSubmit={saveSingle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, marginBottom: 10 }}>
            <input value={form.code} onChange={(e) => setField("code", e.target.value)} placeholder="รหัสรถ/บอร์ด * (เช่น 1)" required maxLength={20} />
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="ทะเบียนรถ (เช่น 1กข-4582 กทม.)" maxLength={60} />
            <input value={form.brand} onChange={(e) => setField("brand", e.target.value)} placeholder="ยี่ห้อรถ (เช่น Isuzu, Hino, Toyota)" maxLength={60} />
            <input value={form.model} onChange={(e) => setField("model", e.target.value)} placeholder="รุ่นรถ (เช่น ELF NMR 130, Revo)" maxLength={60} />
            <input value={form.vehicle_info} onChange={(e) => setField("vehicle_info", e.target.value)} placeholder="ข้อมูลรถ (เช่น 6 ล้อตู้ทึบ, ห้องเย็น)" maxLength={120} />
            <input value={form.driver_code} onChange={(e) => setField("driver_code", e.target.value)} placeholder="รหัสพนักงาน (เช่น EMP001)" maxLength={40} />
            <input value={form.driver_name} onChange={(e) => setField("driver_name", e.target.value)} placeholder="ชื่อ-นามสกุลคนขับ (เช่น สมชาย ใจดี)" maxLength={80} />
            <input value={form.driver_phone} onChange={(e) => setField("driver_phone", e.target.value)} placeholder="เบอร์โทรคนขับ (เช่น 081-234-5678)" maxLength={40} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary" disabled={busy}>💾 บันทึกข้อมูลรถและคนขับ</button>
            {form.code && (
              <button type="button" onClick={() => setForm(EMPTY_FORM)}>ยกเลิกการแก้ไข</button>
            )}
          </div>
        </form>
      </div>

      {/* 3. Full Table of Vehicles & Drivers */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <b>📋 รายชื่อรถและพนักงานขับรถทั้งหมด ({filtered.length} คัน)</b>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาชื่อคนขับ, รหัสพนักงาน, ทะเบียน, ยี่ห้อรถ…"
            style={{ maxWidth: 320 }}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>รหัสรถ</th>
              <th>ทะเบียนรถ</th>
              <th>ยี่ห้อ / รุ่น</th>
              <th>ข้อมูลรถ</th>
              <th>รหัสพนักงาน</th>
              <th>ชื่อ-นามสกุลผู้ขับ</th>
              <th>เบอร์โทร</th>
              <th>สถานะบอร์ด</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td><b>คันที่ {t.code}</b></td>
                <td>{t.name || "—"}</td>
                <td><b>{[t.brand, t.model].filter(Boolean).join(" ") || "—"}</b></td>
                <td>{t.vehicle_info || "—"}</td>
                <td>{t.driver_code || "—"}</td>
                <td><b>{t.driver_name || "—"}</b></td>
                <td>{t.driver_phone ? <a href={`tel:${t.driver_phone}`}>{t.driver_phone}</a> : "—"}</td>
                <td>{t.online ? <span className="pill l0">ออนไลน์</span> : <span className="muted">{t.seen}</span>}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => editRow(t)}>✏️ แก้ไข</button>
                  <button type="button" onClick={() => deleteRow(t)}>🗑️ ลบ</button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={9} className="muted">ยังไม่มีข้อมูลรถและพนักงาน</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
