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

  useEffect(() => {
    draw(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  function draw(list) {
    const { L, map, layer } = st.current;
    if (!map) return;
    layer.clearLayers();

    // Merge events at the same place (~10 m) into one circle so every case stays clickable.
    const groups = new Map();
    for (const p of list || []) {
      const lat = Number(p.lat), lon = Number(p.lon);
      if (p.lat == null || p.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      let g = groups.get(key);
      if (!g) {
        g = { lat, lon, items: [], red: false };
        groups.set(key, g);
      }
      g.items.push(p);
      if (p.level === 2) g.red = true;
    }

    const MAX_LINES = 10;
    const coords = [];
    const redMarkers = [];
    for (const g of groups.values()) {
      const n = g.items.length;
      const col = g.red ? "#ef4444" : "#f59e0b";
      // newest first (points come newest-first from the server; ts makes it explicit)
      const items = g.items.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
      // Outer soft heat halo grows with the number of cases (capped)
      L.circleMarker([g.lat, g.lon], {
        radius: Math.min(44, (g.red ? 24 : 18) + (n - 1) * 3),
        stroke: false,
        fillColor: col,
        fillOpacity: g.red ? 0.25 : 0.18,
        interactive: false,
      }).addTo(layer);
      // Inner core dot (clickable)
      const lines = items.slice(0, MAX_LINES).map((p) =>
        `${p.level === 2 ? "🔴" : "🟡"} ${esc(p.time)} · รถคันที่ ${esc(p.truck)}` +
        `${p.driver ? " · " + esc(p.driver) : ""}<br>&nbsp;&nbsp;สาเหตุ: <b>${esc(p.reason)}</b>`
      );
      const more = n > MAX_LINES ? `<br><i>และอีก ${n - MAX_LINES} เคส</i>` : "";
      const head = `<b>${g.red ? "🔴 จุดอันตราย" : "🟡 จุดเตือน"} · ${n} เคส</b><br>`;
      const marker = L.circleMarker([g.lat, g.lon], {
        radius: Math.min(16, (g.red ? 8 : 6) + (n - 1)),
        color: "#fff",
        weight: 1.5,
        fillColor: col,
        fillOpacity: 0.95,
      })
        .bindPopup(head + lines.join("<br>") + more, { maxHeight: 260 })
        .addTo(layer);
      if (g.red) redMarkers.push(marker);
      coords.push([g.lat, g.lon]);
    }
    // red spots drawn on top of nearby orange ones
    for (const m of redMarkers) m.bringToFront();
    if (coords.length) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 });
    }
  }

  return <div id="map" ref={box} style={{ height: 380, borderRadius: 8 }} />;
}
