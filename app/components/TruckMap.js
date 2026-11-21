"use client";
import { useEffect, useRef, useState } from "react";

const COLORS = { 0: "#1f9d55", 1: "#c98a00", 2: "#d32f2f", off: "#8a919c" };
const LEVEL_TXT = ["ปกติ", "เตือน (ง่วง)", "อันตราย (หลับใน)"];

function playControlRoomBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {}
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {                                   // fallback for browsers without the clipboard API
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const fmtCoord = (v) => Number(v).toFixed(6);
const gmapsUrl = (t) => `https://www.google.com/maps?q=${fmtCoord(t.lat)},${fmtCoord(t.lon)}`;
const gmapsDirUrl = (t) => `https://www.google.com/maps/dir/?api=1&destination=${fmtCoord(t.lat)},${fmtCoord(t.lon)}&travelmode=driving`;
const statusTxt = (t) => (t.online ? LEVEL_TXT[t.level ?? 0] : "ขาดการติดต่อ");

// address of a point (OpenStreetMap Nominatim, Thai), cached per ~10 m
const addrCache = new Map();
async function reverseGeocode(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (addrCache.has(key)) return addrCache.get(key);
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=th&lat=${lat}&lon=${lon}`
  );
  if (!r.ok) throw new Error("geocode " + r.status);
  const d = await r.json();
  const addr = d.display_name || null;
  addrCache.set(key, addr);
  return addr;
}

function emergencyText(t, addr) {
  const car = [t.brand, t.model, t.vehicle_info].filter(Boolean).join(" ");
  const drv = [t.driver_name, t.driver_code ? `(${t.driver_code})` : ""].filter(Boolean).join(" ");
  const ev = t.last_event;
  return [
    `🚨 แจ้งเหตุรถคันที่ ${t.code}${t.name ? " · " + t.name : ""}`,
    drv && `👤 คนขับ: ${drv}${t.driver_phone ? " · โทร " + t.driver_phone : ""}`,
    car && `🚚 รถ: ${car}`,
    `⚠️ สถานะ: ${statusTxt(t)}${ev && ev.open ? ` · เคสค้าง: ${ev.reasons} (${ev.at})` : ""}`,
    addr && `📍 ที่อยู่โดยประมาณ: ${addr}`,
    `🧭 พิกัด: ${fmtCoord(t.lat)}, ${fmtCoord(t.lon)}`,
    `🗺️ Google Maps: ${gmapsUrl(t)}`,
    `🕒 ข้อมูลล่าสุด: ${t.seen}${t.speed != null ? ` · ความเร็ว ${Math.round(t.speed)} กม./ชม.` : ""}`,
  ].filter(Boolean).join("\n");
}

// one truck's details with copy / call / navigate buttons (shown when its map icon is clicked)
function TruckDetail({ t, onClose }) {
  const [addr, setAddr] = useState(null);
  const [addrState, setAddrState] = useState("loading");
  const [copied, setCopied] = useState("");
  const hasLoc = t.lat != null && t.lon != null;

  useEffect(() => {
    if (!hasLoc) return;
    let alive = true;
    // keep showing the last address while a small GPS move is looked up (no flicker every refresh)
    const id = setTimeout(() => {
      reverseGeocode(t.lat, t.lon)
        .then((a) => { if (alive && a) { setAddr(a); setAddrState("ok"); } else if (alive) setAddrState((s) => (s === "ok" ? s : "none")); })
        .catch(() => { if (alive) setAddrState((s) => (s === "ok" ? s : "error")); });
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [hasLoc, t.lat, t.lon]);

  async function copy(key, text) {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1800);
    }
  }
  const CopyBtn = ({ k, text, children, primary }) => (
    <button type="button" className={primary ? "primary" : ""} onClick={() => copy(k, text)}>
      {copied === k ? "✓ คัดลอกแล้ว" : children}
    </button>
  );

  const car = [t.brand, t.model].filter(Boolean).join(" ");
  const ev = t.last_event;
  const lvl = t.online ? `l${t.level ?? 0}` : "off";
  return (
    <aside className="tdetail" aria-label={`รายละเอียดรถคันที่ ${t.code}`}>
      <div className="tdetail-head">
        <div>
          <div className="tdetail-title">🚚 รถคันที่ {t.code}</div>
          {t.name && <div className="muted" style={{ fontSize: 13 }}>{t.name}</div>}
        </div>
        <button type="button" className="tdetail-x" onClick={onClose} aria-label="ปิด">✕</button>
      </div>

      <div className={`tdetail-status ${lvl}`}>
        {t.online ? (t.level === 2 ? "🔴 " : t.level === 1 ? "🟡 " : "🟢 ") : "⚪ "}
        {statusTxt(t)}
      </div>
      {ev && ev.open && (
        <div className="tdetail-alert">
          🚨 เคสค้าง: {ev.reasons} <span className="muted">· {ev.at}</span>
        </div>
      )}

      <div className="tdetail-sec">
        <div className="k">📍 ตำแหน่งล่าสุด</div>
        {hasLoc ? (
          <>
            <div className="tdetail-addr">
              {addrState === "loading" && <span className="muted">กำลังหาที่อยู่…</span>}
              {addrState === "ok" && addr}
              {(addrState === "error" || addrState === "none") && <span className="muted">หาที่อยู่ไม่ได้ (ใช้พิกัดด้านล่าง)</span>}
            </div>
            <div className="tdetail-coord">{fmtCoord(t.lat)}, {fmtCoord(t.lon)}</div>
            <div className="tdetail-btns">
              <CopyBtn k="all" text={emergencyText(t, addr)} primary>📋 คัดลอกข้อมูลแจ้งเหตุทั้งหมด</CopyBtn>
              <CopyBtn k="coord" text={`${fmtCoord(t.lat)}, ${fmtCoord(t.lon)}`}>📋 คัดลอกพิกัด</CopyBtn>
              <CopyBtn k="link" text={gmapsUrl(t)}>🔗 คัดลอกลิงก์แผนที่</CopyBtn>
              {addr && <CopyBtn k="addr" text={addr}>🏠 คัดลอกที่อยู่</CopyBtn>}
              <a className="btn" href={gmapsDirUrl(t)} target="_blank" rel="noopener noreferrer">🧭 นำทางไปที่รถ</a>
            </div>
          </>
        ) : (
          <div className="muted">ยังไม่มีพิกัดจากรถคันนี้</div>
        )}
      </div>

      <div className="tdetail-sec">
        <div className="k">👤 คนขับ</div>
        {t.driver_name || t.driver_code ? (
          <div><b>{t.driver_name || "—"}</b>{t.driver_code && <span className="muted"> ({t.driver_code})</span>}</div>
        ) : (
          <div className="muted">ยังไม่ระบุ</div>
        )}
        {t.driver_phone && (
          <div className="tdetail-btns">
            <a className="btn" href={`tel:${t.driver_phone}`}>📞 โทร {t.driver_phone}</a>
            <CopyBtn k="phone" text={t.driver_phone}>📋 คัดลอกเบอร์</CopyBtn>
          </div>
        )}
      </div>

      <div className="tdetail-sec">
        <div className="k">🚚 ข้อมูลรถ</div>
        <div className="tdetail-grid">
          <span className="muted">ยี่ห้อ/รุ่น</span><span>{car || "—"}</span>
          <span className="muted">รายละเอียด</span><span>{t.vehicle_info || "—"}</span>
          <span className="muted">ความเร็ว</span><span>{t.speed == null ? "—" : `${Math.round(t.speed)} กม./ชม.`}</span>
          <span className="muted">กล้อง</span><span>{t.camera_ok == null ? "—" : t.camera_ok ? "ปกติ" : "⚠️ ไม่มีภาพ"}</span>
          <span className="muted">เคสค้าง</span><span>{t.open || 0}</span>
          <span className="muted">ติดต่อล่าสุด</span><span>{t.seen}</span>
        </div>
      </div>

      <div className="tdetail-sec">
        <div className="k">☎️ เบอร์ฉุกเฉิน</div>
        <div className="tdetail-btns">
          <a className="btn" href="tel:1669">🚑 1669 เจ็บป่วยฉุกเฉิน</a>
          <a className="btn" href="tel:1193">🚓 1193 ตำรวจทางหลวง</a>
        </div>
      </div>
    </aside>
  );
}

// C2: every truck's last known position + click an icon for full details (copy location to send help)
// + control-room red alert banner & sound chime.
export default function TruckMap({ trucks }) {
  const box = useRef(null);
  const st = useRef({ L: null, map: null, layer: null, markers: {}, fitted: false });
  const [soundOn, setSoundOn] = useState(false);
  const [sel, setSel] = useState(null);
  const selRef = useRef(null);
  selRef.current = sel;

  const dangerTrucks = trucks.filter((t) => (t.online && t.level === 2) || t.open > 0);
  const selTruck = sel != null ? trucks.find((t) => t.code === sel) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || st.current.map) return;
      const map = L.map(box.current).setView([13.65, 100.63], 7);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      st.current = { L, map, layer: L.layerGroup().addTo(map), markers: {}, fitted: false };
      draw(trucks);
    })();
    window.__focusTruck = (code) => {
      const m = st.current.markers[code];
      const map = st.current.map;
      setSel(code);
      if (m && map) {
        map.setView(m.getLatLng(), 16, { animate: true });
        box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    return () => {
      cancelled = true;
      if (st.current.map) st.current.map.remove();
      st.current = { L: null, map: null, layer: null, markers: {}, fitted: false };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draw(trucks);
    if (soundOn && dangerTrucks.length > 0) {
      playControlRoomBeep();
    }
  });

  // the details panel covers the right side of the map on wide screens: keep the map size right
  useEffect(() => {
    const map = st.current.map;
    if (map) setTimeout(() => map.invalidateSize(), 50);
  }, [sel]);

  function draw(list) {
    const { L, map, layer } = st.current;
    if (!map) return;
    layer.clearLayers();
    st.current.markers = {};
    const pts = [];
    for (const t of list) {
      if (t.lat == null || t.lon == null) continue;
      const color = t.online ? COLORS[t.level ?? 0] : COLORS.off;
      const picked = selRef.current === t.code;
      if (picked) {
        L.circleMarker([t.lat, t.lon], { radius: 20, color: "#2563eb", weight: 3, fill: false, interactive: false }).addTo(layer);
      }
      const marker = L.circleMarker([t.lat, t.lon], {
        radius: t.level === 2 ? 13 : 11,
        color: "#fff",
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(`คันที่ ${t.code}${t.driver_name ? " · " + t.driver_name : ""} — คลิกดูรายละเอียด`, { direction: "top", offset: [0, -10] })
        .on("click", () => setSel(t.code))
        .addTo(layer);
      st.current.markers[t.code] = marker;
      pts.push([t.lat, t.lon]);
    }
    if (pts.length && !st.current.fitted) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
      st.current.fitted = true;
    }
  }

  return (
    <>
      {dangerTrucks.length > 0 && (
        <div
          style={{
            marginBottom: 10, padding: "10px 14px", borderRadius: 10,
            background: "rgba(211,47,47,0.14)", border: "2px solid var(--alarm)",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
          }}
        >
          <div>
            <b style={{ color: "var(--alarm)" }}>
              🚨 แจ้งเตือนศูนย์ควบคุม: มีรถที่มีเคสค้างหรืออยู่ในสถานะอันตราย ({dangerTrucks.map((t) => `คันที่ ${t.code} ${t.driver_name || ""}`).join(", ")})
            </b>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dangerTrucks[0] && dangerTrucks[0].lat != null && (
              <button type="button" className="primary" onClick={() => window.__focusTruck(dangerTrucks[0].code)}>
                📍 ดูตำแหน่งรถคันนี้
              </button>
            )}
            <a className="btn" href="/alerts">ดูเคสแจ้งเตือน</a>
            <button type="button" onClick={() => { setSoundOn(!soundOn); if (!soundOn) playControlRoomBeep(); }}>
              {soundOn ? "🔊 เสียงเตือนศูนย์ควบคุม: เปิด" : "🔇 เปิดเสียงเตือนศูนย์ควบคุม"}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 13, gap: 8, flexWrap: "wrap" }} className="muted">
        <span>💡 คลิกที่ไอคอนรถบนแผนที่ (หรือปุ่ม 🎯 ในตาราง) เพื่อดูรายละเอียดและคัดลอกตำแหน่งส่งความช่วยเหลือ</span>
        {dangerTrucks.length === 0 && (
          <button type="button" onClick={() => { setSoundOn(!soundOn); if (!soundOn) playControlRoomBeep(); }} style={{ padding: "3px 10px", fontSize: 12 }}>
            {soundOn ? "🔊 เสียงเตือนศูนย์ควบคุม: เปิด" : "🔇 เปิดเสียงเตือนศูนย์ควบคุม"}
          </button>
        )}
      </div>
      <div className={`mapwrap${selTruck ? " has-detail" : ""}`}>
        <div id="map" ref={box} />
        {selTruck && <TruckDetail key={selTruck.code} t={selTruck} onClose={() => setSel(null)} />}
      </div>
    </>
  );
}
