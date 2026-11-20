"use client";
import { useEffect, useRef } from "react";

const COLORS = { 0: "#1f9d55", 1: "#c98a00", 2: "#d32f2f", off: "#8a919c" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// C2: every truck's last known position. trucks = [{code, name, lat, lon, level, online, seen}]
// The map is created once; on each refresh only the markers are redrawn (zoom/pan are kept).
export default function TruckMap({ trucks }) {
  const box = useRef(null);
  const st = useRef({ L: null, map: null, layer: null, fitted: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || st.current.map) return;
      const map = L.map(box.current).setView([13.4, 101.0], 6);   // Thailand
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      st.current = { L, map, layer: L.layerGroup().addTo(map), fitted: false };
      draw(trucks);
    })();
    return () => {
      cancelled = true;
      if (st.current.map) st.current.map.remove();
      st.current = { L: null, map: null, layer: null, fitted: false };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { draw(trucks); });   // after every render (new data from the auto refresh)

  function draw(list) {
    const { L, map, layer } = st.current;
    if (!map) return;
    layer.clearLayers();
    const pts = [];
    for (const t of list) {
      if (t.lat == null || t.lon == null) continue;
      const color = t.online ? COLORS[t.level ?? 0] : COLORS.off;
      L.circleMarker([t.lat, t.lon], { radius: 9, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
        .bindPopup(`<b>รถ ${esc(t.code)}</b>${t.name ? " · " + esc(t.name) : ""}<br>` +
                   `${t.online ? "ออนไลน์" : "ขาดการติดต่อ"} · ${esc(t.seen)}`)
        .addTo(layer);
      pts.push([t.lat, t.lon]);
    }
    if (pts.length && !st.current.fitted) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
      st.current.fitted = true;
    }
  }

  return <div id="map" ref={box} />;
}
