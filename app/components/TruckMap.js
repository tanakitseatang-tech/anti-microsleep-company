"use client";
import { useEffect, useRef, useState } from "react";

const COLORS = { 0: "#1f9d55", 1: "#c98a00", 2: "#d32f2f", off: "#8a919c" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

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

// C2: every truck's last known position + click-to-focus + control-room red alert banner & sound chime.
export default function TruckMap({ trucks }) {
  const box = useRef(null);
  const st = useRef({ L: null, map: null, layer: null, markers: {}, fitted: false });
  const [soundOn, setSoundOn] = useState(false);

  const dangerTrucks = trucks.filter((t) => (t.online && t.level === 2) || t.open > 0);

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
      if (m && map) {
        map.setView(m.getLatLng(), 16, { animate: true });
        m.openPopup();
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

  function draw(list) {
    const { L, map, layer } = st.current;
    if (!map) return;
    layer.clearLayers();
    st.current.markers = {};
    const pts = [];
    for (const t of list) {
      if (t.lat == null || t.lon == null) continue;
      const color = t.online ? COLORS[t.level ?? 0] : COLORS.off;
      const car = [t.brand, t.model, t.vehicle_info ? `(${t.vehicle_info})` : ""].filter(Boolean).join(" ");
      const drv = [t.driver_name, t.driver_code ? `(${t.driver_code})` : "", t.driver_phone ? `📞 ${t.driver_phone}` : ""].filter(Boolean).join(" ");
      const html =
        `<b>รถคันที่ ${esc(t.code)}</b>${t.name ? " · " + esc(t.name) : ""}<br>` +
        (car ? `🚚 ${esc(car)}<br>` : "") +
        (drv ? `👤 ${esc(drv)}<br>` : "") +
        `${t.online ? "🟢 ออนไลน์" : "⚪ ขาดการติดต่อ"} · ${esc(t.seen)}`;
      const marker = L.circleMarker([t.lat, t.lon], {
        radius: t.level === 2 ? 12 : 9,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindPopup(html)
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
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn" href="/alerts">ดูเคสแจ้งเตือน</a>
            <button type="button" onClick={() => { setSoundOn(!soundOn); if (!soundOn) playControlRoomBeep(); }}>
              {soundOn ? "🔊 เสียงเตือนศูนย์ควบคุม: เปิด" : "🔇 เปิดเสียงเตือนศูนย์ควบคุม"}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 13 }} className="muted">
        <span>💡 คลิกที่แถวรถในตารางด้านล่างเพื่อซูมแผนที่ไปยังรถคันนั้น</span>
        {dangerTrucks.length === 0 && (
          <button type="button" onClick={() => { setSoundOn(!soundOn); if (!soundOn) playControlRoomBeep(); }} style={{ padding: "3px 10px", fontSize: 12 }}>
            {soundOn ? "🔊 เสียงเตือนศูนย์ควบคุม: เปิด" : "🔇 เปิดเสียงเตือนศูนย์ควบคุม"}
          </button>
        )}
      </div>
      <div id="map" ref={box} />
    </>
  );
}
