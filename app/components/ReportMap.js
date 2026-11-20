"use client";
import { useEffect, useRef } from "react";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// C6: Drowsiness Danger-Zone Heatmap showing where warning & red-alarm events cluster on roads.
export default function ReportMap({ points }) {
  const box = useRef(null);
  const st = useRef({ L: null, map: null, layer: null });

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
      st.current = { L, map, layer: L.layerGroup().addTo(map) };
      draw(points);
    })();
    return () => {
      cancelled = true;
      if (st.current.map) st.current.map.remove();
      st.current = { L: null, map: null, layer: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { draw(points); });

  function draw(list) {
    const { L, map, layer } = st.current;
    if (!map) return;
    layer.clearLayers();
    const coords = [];
    for (const p of list || []) {
      if (p.lat == null || p.lon == null) continue;
      const isRed = p.level === 2;
      const col = isRed ? "#ef4444" : "#f59e0b";
      // Outer soft heat halo
      L.circleMarker([p.lat, p.lon], {
        radius: isRed ? 24 : 18,
        stroke: false,
        fillColor: col,
        fillOpacity: isRed ? 0.25 : 0.18,
        interactive: false,
      }).addTo(layer);
      // Inner core dot
      L.circleMarker([p.lat, p.lon], {
        radius: isRed ? 8 : 6,
        color: "#fff",
        weight: 1.5,
        fillColor: col,
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<b>${isRed ? "🔴 อันตราย" : "🟡 เตือน"} · รถคันที่ ${esc(p.truck)}</b><br>` +
          `${esc(p.driver || "")}<br>` +
          `สาเหตุ: <b>${esc(p.reason)}</b><br>` +
          `เวลา: ${esc(p.time)}`
        )
        .addTo(layer);
      coords.push([p.lat, p.lon]);
    }
    if (coords.length) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 });
    }
  }

  return <div id="map" ref={box} style={{ height: 380, borderRadius: 8 }} />;
}
