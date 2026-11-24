"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const COLORS = { 0: "#1f9d55", 1: "#c98a00", 2: "#d32f2f", off: "#8a919c" };
const LEVEL_TXT = ["ปกติ", "เตือน (ง่วง)", "อันตราย (หลับใน)"];
const escHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Demo-only client-side fleet simulator: 7 trucks driving on real Thai highways (OSRM).
// Zero DB writes, zero Vercel/Supabase quota burn, clearly labeled "(จำลอง)" for judges.
const SIM_FLEET_DEFS = [
  { code: "SIM-02", name: "70-2002 กทม (จำลอง)", brand: "ISUZU", model: "GXZ 360", vehicle_info: "รถบรรทุก 10 ล้อ · ทล.1 พหลโยธิน", driver_name: "สมศักดิ์ (จำลอง)", driver_code: "902", driver_phone: "0XX-XXX-XXXX", speedKmh: 88, start: [14.0208, 100.6164], end: [16.8839, 99.1258] },
  { code: "SIM-03", name: "70-3003 กทม (จำลอง)", brand: "HINO", model: "Victor 500", vehicle_info: "รถบรรทุก 10 ล้อ · ทล.4 เพชรเกษม", driver_name: "วิชัย (จำลอง)", driver_code: "903", driver_phone: "0XX-XXX-XXXX", speedKmh: 82, start: [13.1119, 99.9398], end: [11.8124, 99.7973] },
  { code: "SIM-04", name: "70-4004 กทม (จำลอง)", brand: "ISUZU", model: "FXZ 360", vehicle_info: "รถบรรทุก 10 ล้อ · ทล.2 มิตรภาพ", driver_name: "ประยุทธ์ (จำลอง)", driver_code: "904", driver_phone: "0XX-XXX-XXXX", speedKmh: 85, start: [14.5289, 100.9101], end: [14.9799, 102.0978] },
  { code: "SIM-05", name: "70-5005 ชบ (จำลอง)", brand: "SCANIA", model: "P360", vehicle_info: "รถหัวลากตู้คอนเทนเนอร์ · มอเตอร์เวย์ 7", driver_name: "สุรชัย (จำลอง)", driver_code: "905", driver_phone: "0XX-XXX-XXXX", speedKmh: 80, start: [13.7278, 100.7478], end: [13.0956, 100.9182] },
  { code: "SIM-06", name: "70-6006 สฎ (จำลอง)", brand: "HINO", model: "FM1A", vehicle_info: "รถบรรทุก 10 ล้อห้องเย็น · ทล.41", driver_name: "มานพ (จำลอง)", driver_code: "906", driver_phone: "0XX-XXX-XXXX", speedKmh: 78, start: [10.4930, 99.1800], end: [9.1382, 99.3217] },
  { code: "SIM-07", name: "70-7007 พล (จำลอง)", brand: "ISUZU", model: "FVM 240", vehicle_info: "รถบรรทุก 6 ล้อ · ทล.11", driver_name: "อนุชา (จำลอง)", driver_code: "907", driver_phone: "0XX-XXX-XXXX", speedKmh: 80, start: [16.8211, 100.2659], end: [17.6200, 100.0993] },
  { code: "SIM-08", name: "70-8008 นม (จำลอง)", brand: "UD", model: "Quester", vehicle_info: "รถบรรทุก 10 ล้อ · ทล.304", driver_name: "เกรียงไกร (จำลอง)", driver_code: "908", driver_phone: "0XX-XXX-XXXX", speedKmh: 72, start: [14.0509, 101.3727], end: [14.7186, 102.0222] },
];

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function fetchSimRoad(start, end) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (res.ok) {
      const d = await res.json();
      if (d.code === "Ok" && d.routes?.[0]?.geometry?.coordinates?.length >= 2) {
        return d.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      }
    }
  } catch {}
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    pts.push([start[0] + (end[0] - start[0]) * f, start[1] + (end[1] - start[1]) * f]);
  }
  return pts;
}

let sharedAudioCtx = null;
// Create the shared AudioContext if needed and ask the browser to un-suspend it.
// Returns the resume promise (resolves once the browser allows sound, e.g. after a click).
function wakeAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return Promise.resolve(false);
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new Ctx();
    }
    if (sharedAudioCtx.state === "suspended") {
      return sharedAudioCtx.resume().then(() => sharedAudioCtx.state === "running", () => false);
    }
    return Promise.resolve(sharedAudioCtx.state === "running");
  } catch {
    return Promise.resolve(false);
  }
}

// Plays one short chime. Returns true only if it really played.
// While the browser still blocks sound (no click yet) it creates NO oscillator, so retries
// do not queue up beeps that would all blast at once on the first click.
function playControlRoomBeep() {
  try {
    wakeAudio();
    const ctx = sharedAudioCtx;
    if (!ctx || ctx.state !== "running") return false;
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
    return true;
  } catch {
    return false;
  }
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
export default function TruckMap({ trucks, today = { total: 0, alarms: 0 }, canManage = false }) {
  const box = useRef(null);
  const lastBeepKey = useRef("");     // danger set we already beeped for
  const lastBeepAt = useRef(0);       // time of the last beep that really played
  const dangerKeyRef = useRef("");
  const st = useRef({ L: null, map: null, layer: null, markers: {}, fitted: false });
  const [soundOn, setSoundOn] = useState(false);
  const [simOn, setSimOn] = useState(false);
  const [simTrucks, setSimTrucks] = useState([]);
  const simStateRef = useRef([]);
  const [sel, setSel] = useState(null);
  const selRef = useRef(null);
  selRef.current = sel;

  useEffect(() => {
    if (!simOn) {
      setSimTrucks([]);
      return;
    }
    let cancelled = false;
    let timer = null;
    (async () => {
      if (simStateRef.current.length === 0) {
        const built = await Promise.all(
          SIM_FLEET_DEFS.map(async (cfg, idx) => {
            const pts = await fetchSimRoad(cfg.start, cfg.end);
            const seg = Math.floor(pts.length * (0.15 + ((idx * 13) % 50) / 100));
            return {
              ...cfg,
              pts,
              seg,
              dist: 0,
              lat: pts[seg][0],
              lon: pts[seg][1],
              speed: cfg.speedKmh,
              level: 0,
            };
          })
        );
        if (cancelled) return;
        simStateRef.current = built;
      }
      const snapshot = () =>
        simStateRef.current.map((s) => ({
          code: s.code,
          name: s.name,
          brand: s.brand,
          model: s.model,
          vehicle_info: s.vehicle_info,
          driver_name: s.driver_name,
          driver_code: s.driver_code,
          driver_phone: s.driver_phone,
          lat: s.lat,
          lon: s.lon,
          speed: s.speed,
          level: s.level,
          online: true,
          camera_ok: true,
          open: 0,
          open_red: 0,
          seen: "จำลองสด",
          last_seen: new Date().toISOString(),
          last_event: null,
          is_sim: true,
        }));
      setSimTrucks(snapshot());
      st.current.fitted = false;
      let tick = 0;
      timer = setInterval(() => {
        tick++;
        const warnIdx = tick % 12 === 0 ? Math.floor(tick / 12) % simStateRef.current.length : -1;
        for (let i = 0; i < simStateRef.current.length; i++) {
          const s = simStateRef.current[i];
          const curSpeed = Math.max(50, Math.min(95, s.speedKmh + (Math.random() - 0.5) * 4));
          let dist = s.dist + 1.5 * (curSpeed / 3.6); // 1x real-time highway speed
          let seg = s.seg;
          while (seg < s.pts.length - 1) {
            const a = s.pts[seg], b = s.pts[seg + 1];
            const len = Math.max(1, haversineM(a[0], a[1], b[0], b[1]));
            if (dist <= len) {
              const f = dist / len;
              s.lat = a[0] + (b[0] - a[0]) * f;
              s.lon = a[1] + (b[1] - a[1]) * f;
              s.seg = seg;
              s.dist = dist;
              s.speed = Math.round(curSpeed);
              break;
            }
            dist -= len;
            seg++;
          }
          if (seg >= s.pts.length - 1) {
            s.pts.reverse();
            s.seg = 0;
            s.dist = 0;
            s.lat = s.pts[0][0];
            s.lon = s.pts[0][1];
          }
          s.level = i === warnIdx ? 1 : 0;
        }
        setSimTrucks(snapshot());
      }, 1500);
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [simOn]);

  // Remember the control-room sound switch in this browser (a reload no longer turns it off).
  // Browsers only allow sound after the first click/key on the page, so wake the audio then.
  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem("ams_sound_on") === "1"; } catch {}
    if (!saved) return;
    setSoundOn(true);
    const wake = () => { wakeAudio(); };
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);
  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem("ams_sound_on", next ? "1" : "0"); } catch {}
    if (!next) return;
    // same click: ask once for desktop notifications (red cases while the tab is in the background)
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    } catch {}
    // The click allows sound: wait for the audio to wake, then play ONE confirmation beep.
    // If the alarm effect below already beeped for a danger truck just now, skip it (no double beep).
    wakeAudio().then((ok) => {
      if (!ok || Date.now() - lastBeepAt.current < 1500) return;
      if (playControlRoomBeep()) {
        lastBeepAt.current = Date.now();
        if (dangerKeyRef.current) lastBeepKey.current = dangerKeyRef.current; // counts as the "new red case" beep
      }
    });
  }

  // Red banner + beep only for real danger: a truck in RED right now, or an open RED (level 2)
  // case. Yellow warnings (yawn, face not visible, ...) stay quiet in the table and /alerts.
  const allTrucks = simOn ? [...trucks, ...simTrucks] : trucks;
  const onlineCount = allTrucks.filter((t) => t.online).length;
  const dangerTrucks = trucks.filter((t) => (t.online && t.level === 2) || (t.open_red || 0) > 0);
  // banner: a truck that is RED right now vs. a red case from earlier that nobody closed yet
  const liveNowTrucks = dangerTrucks.filter((t) => t.online && t.level === 2);
  const oldOpenTrucks = dangerTrucks.filter((t) => !(t.online && t.level === 2));
  const truckNames = (list) => list.map((t) => `คันที่ ${t.code}${t.driver_name ? " " + t.driver_name : ""}`).join(", ");
  const selTruck = sel != null ? allTrucks.find((t) => t.code === sel) : null;
  // Table order: red trucks first (RED right now, then open red case), then real trucks before
  // simulated ones, then by code (numeric-aware, so "2" comes before "10").
  const dangerRank = (t) => (t.online && t.level === 2 ? 0 : (t.open_red || 0) > 0 ? 1 : 2);
  const tableTrucks = allTrucks.slice().sort((a, b) =>
    dangerRank(a) - dangerRank(b) ||
    (a.is_sim ? 1 : 0) - (b.is_sim ? 1 : 0) ||
    String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
  );

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

  const dangerKey = dangerTrucks
    .map((t) => `${t.code}:${t.level}:${t.open_red}:${t.last_event?.id ?? ""}`)
    .join("|");
  dangerKeyRef.current = dangerKey;

  useEffect(() => {
    draw(allTrucks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trucks, simTrucks, simOn, sel]);

  // New red case → beep once (remembered only if the browser really played it).
  // While a truck is RED right now → keep beeping every 5 s until it is handled.
  const liveRed = dangerTrucks.some((t) => t.online && t.level === 2);
  // If the browser still blocks sound (no click on the page yet), keep retrying every 2.5 s.
  useEffect(() => {
    if (!dangerKey) { lastBeepKey.current = ""; return; }
    if (!soundOn) return;
    const check = () => {
      const now = Date.now();
      if (dangerKey !== lastBeepKey.current) {
        if (playControlRoomBeep()) { lastBeepKey.current = dangerKey; lastBeepAt.current = now; }
      } else if (liveRed && now - lastBeepAt.current >= 5000) {
        if (playControlRoomBeep()) lastBeepAt.current = now;
      }
    };
    check();
    const id = setInterval(check, 2500);
    return () => clearInterval(id);
  }, [soundOn, dangerKey, liveRed]);

  // Browser tab title: flashes "🚨 หลับใน! คันที่ 1" while a truck is RED right now, and shows
  // "(🔴 2)" for open red cases, so the control room notices even from another tab.
  const liveNames = liveNowTrucks.map((t) => t.code).join(", ");
  const openRedCount = oldOpenTrucks.length;
  useEffect(() => {
    const base = "Anti-Microsleep · บริษัท";
    if (liveNames) {
      const alarm = `🚨 หลับใน! คันที่ ${liveNames}`;
      let on = true;
      document.title = alarm;
      const id = setInterval(() => { on = !on; document.title = on ? alarm : `⚠️ ${base}`; }, 1000);
      return () => { clearInterval(id); document.title = base; };
    }
    document.title = openRedCount ? `(🔴 ${openRedCount}) ${base}` : base;
    return () => { document.title = base; };
  }, [liveNames, openRedCount]);

  // Desktop notification for each NEW red case (works while the tab is in the background).
  // Permission is asked when the control room turns the sound switch on (needs a click).
  const notified = useRef(null);   // keys already seen; null = first render (don't notify old cases)
  useEffect(() => {
    const keys = dangerTrucks.map((t) => ({ t, k: `${t.code}:${t.last_event?.id ?? ""}` }));
    if (notified.current === null) { notified.current = new Set(keys.map((x) => x.k)); return; }
    for (const { t, k } of keys) {
      if (notified.current.has(k)) continue;
      notified.current.add(k);
      if (typeof Notification === "undefined" || Notification.permission !== "granted") continue;
      if (!document.hidden && document.hasFocus()) continue;   // already looking at the dashboard
      try {
        const n = new Notification(`🚨 หลับใน! รถคันที่ ${t.code}`, {
          body: [t.driver_name && `คนขับ: ${t.driver_name}`, t.last_event?.reasons, t.driver_phone && `📞 ${t.driver_phone}`]
            .filter(Boolean).join("\n"),
          tag: `ams-red-${t.code}`,
          requireInteraction: true,
        });
        n.onclick = () => { window.focus(); window.__focusTruck?.(t.code); n.close(); };
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dangerKey]);

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
    const redMarkers = [];
    for (const t of list) {
      if (t.lat == null || t.lon == null) continue;
      // an open RED case keeps the truck red even if the board went offline (that is the scariest case)
      const color = (t.open_red || 0) > 0 ? COLORS[2] : t.online ? COLORS[t.level ?? 0] : COLORS.off;
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
        .bindTooltip(`${t.is_sim ? "🧪 DEMO · " : ""}คันที่ ${escHtml(t.code)}${t.driver_name ? " · " + escHtml(t.driver_name) : ""} — คลิกดูรายละเอียด`, { direction: "top", offset: [0, -10] })
        .on("click", () => setSel(t.code))
        .addTo(layer);
      st.current.markers[t.code] = marker;
      if (color === COLORS[2]) redMarkers.push(marker);
      pts.push([t.lat, t.lon]);
    }
    // red trucks drawn on top of nearby green/grey ones so they are always visible & clickable
    for (const m of redMarkers) m.bringToFront();
    if (pts.length && !st.current.fitted) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
      st.current.fitted = true;
    }
  }

  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="k">รถออนไลน์</div><div className="v">{onlineCount} / {allTrucks.length}</div></div>
        <div className="tile"><div className="k">ขาดการติดต่อ</div><div className="v">{allTrucks.length - onlineCount}</div></div>
        <div className="tile"><div className="k">แจ้งเตือนวันนี้</div><div className="v">{today.total}</div></div>
        <div className="tile"><div className="k">อันตราย (แดง) วันนี้</div><div className="v">{today.alarms}</div></div>
      </div>
      {dangerTrucks.length > 0 && (
        <div
          style={{
            marginBottom: 10, padding: "10px 14px", borderRadius: 10,
            // red right now = strong red; only old unclosed red cases = calmer
            background: liveNowTrucks.length ? "rgba(211,47,47,0.14)" : "rgba(211,47,47,0.06)",
            border: liveNowTrucks.length ? "2px solid var(--alarm)" : "1px dashed var(--alarm)",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {liveNowTrucks.length > 0 && (
              <b style={{ color: "var(--alarm)" }}>
                🚨 เกิดตอนนี้ — คนขับหลับใน: {truckNames(liveNowTrucks)}
                <span style={{ fontWeight: 400 }}> · ให้โทรหาคนขับทันที</span>
              </b>
            )}
            {oldOpenTrucks.length > 0 && (
              <span style={{ color: "var(--alarm)" }}>
                📋 เคสแดงเก่ายังไม่ปิด: {truckNames(oldOpenTrucks)}
                <span className="muted"> · ตรวจสอบแล้วกด "ปิดเคส" ที่หน้าการแจ้งเตือน</span>
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dangerTrucks[0] && dangerTrucks[0].lat != null && (
              <button type="button" className="primary" onClick={() => window.__focusTruck(dangerTrucks[0].code)}>
                📍 ดูตำแหน่งรถคันนี้
              </button>
            )}
            <a className="btn" href="/alerts">ดูเคสแจ้งเตือน</a>
            <button type="button" onClick={toggleSound}>
              {soundOn ? "🔊 เสียงเตือนศูนย์ควบคุม: เปิด" : "🔇 เปิดเสียงเตือนศูนย์ควบคุม"}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 13, gap: 8, flexWrap: "wrap" }} className="muted">
        <span>💡 คลิกที่ไอคอนรถบนแผนที่ (หรือปุ่ม 🎯 ในตาราง) เพื่อดูรายละเอียดและคัดลอกตำแหน่งส่งความช่วยเหลือ</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setSimOn((v) => !v)}
            style={{
              padding: "3px 10px",
              fontSize: 12,
              background: simOn ? "rgba(37,99,235,0.16)" : undefined,
              borderColor: simOn ? "#2563eb" : undefined,
            }}
          >
            {simOn ? "🚗 จำลองกองรถ 7 คัน: เปิด" : "🚗 จำลองกองรถ 7 คัน"}
          </button>
          {dangerTrucks.length === 0 && (
            <button type="button" onClick={toggleSound} style={{ padding: "3px 10px", fontSize: 12 }}>
              {soundOn ? "🔊 เสียงเตือนศูนย์ควบคุม: เปิด" : "🔇 เปิดเสียงเตือนศูนย์ควบคุม"}
            </button>
          )}
        </div>
      </div>
      <div className="card">
        <div className={`mapwrap${selTruck ? " has-detail" : ""}`}>
          <div id="map" ref={box} />
          {simOn && (
            <div
              style={{
                position: "absolute", top: 10, left: 54, zIndex: 900, pointerEvents: "none",
                maxWidth: selTruck ? "calc(100% - 440px)" : "calc(100% - 70px)",
                background: "#2563eb", color: "#fff", fontWeight: 800, fontSize: 13,
                padding: "4px 10px", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,.3)",
              }}
            >
              🧪 DEMO — รถ SIM-02 ถึง SIM-08 เป็นข้อมูลจำลอง (รถจริงคือคันที่ไม่ขึ้นต้นด้วย SIM)
            </div>
          )}
          {selTruck && <TruckDetail key={selTruck.code} t={selTruck} onClose={() => setSel(null)} />}
        </div>
        {/* what each colour means and what to do */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8, fontSize: 13 }}>
          {[
            [COLORS[0], "ปกติ"],
            [COLORS[1], "ง่วง — คอยดู"],
            [COLORS[2], "หลับใน — โทรหาคนขับทันที"],
            [COLORS.off, "ขาดการติดต่อ (บอร์ดเงียบเกิน 45 วินาที)"],
          ].map(([c, txt]) => (
            <span key={txt} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: c, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.25)", flex: "none" }} />
              {txt}
            </span>
          ))}
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>รหัสรถ / ทะเบียน</th>
              <th>ยี่ห้อ / ข้อมูลรถ</th>
              <th>ผู้ขับรถ (พนักงาน)</th>
              <th>สถานะ</th>
              <th>ความเร็ว</th>
              <th>กล้อง</th>
              <th>เคสค้าง</th>
              <th>ติดต่อล่าสุด</th>
              <th>ดูบนแผนที่</th>
            </tr>
          </thead>
          <tbody>
            {tableTrucks.map((r) => {
              const carTitle = [r.brand, r.model].filter(Boolean).join(" ");
              return (
                <tr key={r.code}>
                  <td>
                    <b>คันที่ {r.code}</b>
                    {r.is_sim && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#fff", background: "#2563eb", borderRadius: 6, padding: "1px 6px" }}>
                        🧪 DEMO
                      </span>
                    )}
                    {r.name && <div className="muted" style={{ fontSize: 13 }}>{r.name}</div>}
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: 160 }}>
                    {carTitle ? <b>{carTitle}</b> : <span className="muted">—</span>}
                    {r.vehicle_info && <div className="muted" style={{ fontSize: 13 }}>{r.vehicle_info}</div>}
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: 170 }}>
                    {r.driver_name || r.driver_code ? (
                      <>
                        <b>{r.driver_name || "—"}</b>
                        {r.driver_code && <span className="muted"> ({r.driver_code})</span>}
                        {r.driver_phone && (
                          <div style={{ fontSize: 13 }}>
                            <a href={`tel:${r.driver_phone}`}>📞 {r.driver_phone}</a>
                          </div>
                        )}
                      </>
                    ) : (
                      canManage
                        ? <span className="muted">ยังไม่ระบุ (<Link href="/trucks">เพิ่มข้อมูล</Link>)</span>
                        : <span className="muted">ยังไม่ระบุ</span>
                    )}
                  </td>
                  <td>
                    {r.rest
                      ? <span className={`pill ${r.rest.over ? "l1" : "l0"}`}>{r.rest.text}</span>
                      : r.online
                        ? <span className={`pill l${r.level ?? 0}`}>{LEVEL_TXT[r.level ?? 0]}</span>
                        : <span className="pill off">ขาดการติดต่อ</span>}
                    {r.rest && !r.online && <div className="muted" style={{ fontSize: 12 }}>บอร์ดปิดอยู่ (ดับเครื่องพัก)</div>}
                    {r.sim_drive && r.online && <div style={{ fontSize: 12, color: "var(--accent)" }}>🧪 ขับจำลอง (เดโม)</div>}
                    {(r.open_red || 0) > 0 && !r.online && <div style={{ fontSize: 12, color: "var(--alarm)" }}>🔴 มีเคสแดงค้าง</div>}
                  </td>
                  <td>{r.speed == null ? "—" : `${Math.round(r.speed)} กม./ชม.`}</td>
                  <td>{r.camera_ok == null ? "—" : r.camera_ok ? "ปกติ" : "⚠️ ไม่มีภาพ"}</td>
                  <td>{r.open || "—"}</td>
                  <td>{r.seen || "—"}</td>
                  <td>
                    <button
                      type="button"
                      disabled={r.lat == null || r.lon == null}
                      onClick={() => window.__focusTruck && window.__focusTruck(r.code)}
                      style={{ padding: "4px 10px", fontSize: 13 }}
                    >
                      🎯 ซูมดูรถ
                    </button>
                  </td>
                </tr>
              );
            })}
            {!allTrucks.length && (
              <tr>
                <td colSpan={9} className="muted">
                  {canManage
                    ? <>ยังไม่มีรถ — เพิ่มหรือนำเข้า Datasheet ที่หน้า <Link href="/trucks">จัดการรถ</Link></>
                    : "ยังไม่มีรถ — ติดต่อผู้ดูแลระบบเพื่อเพิ่มรถ"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
