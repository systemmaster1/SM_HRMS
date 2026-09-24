"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GpsPoint, Stop, Gap } from "@/lib/tracking";
import { fmtClock, fmtMins } from "@/lib/tracking";

export type LivePin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: "live" | "stale" | "offline";
  detail?: string;
};

export type VisitPin = {
  n: number;
  lat: number;
  lng: number;
  title: string;
  detail?: string;
  state: "completed" | "in_progress" | "planned" | "missed" | "cancelled";
};

const LIVE_COLOR = { live: "#059669", stale: "#d97706", offline: "#94a3b8" };
const VISIT_COLOR = {
  completed: "#059669", in_progress: "#2563eb", planned: "#64748b", missed: "#e11d48", cancelled: "#94a3b8",
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function badge(text: string, color: string, size = 26) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#fff;
      display:grid;place-items:center;font:700 11px/1 Inter,system-ui,sans-serif;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35)">${esc(text)}</div>`,
  });
}

/**
 * One map for both modes:
 *  - Live: a pin per employee (green = live, amber = stale, grey = offline).
 *  - Day route: the GPS path, start/end, numbered visits, stops and GPS gaps.
 */
export default function TrackingMap({
  live = [], route = [], visits = [], stops = [], gaps = [], onSelect, className = "h-[420px]",
}: {
  live?: LivePin[];
  route?: GpsPoint[];
  visits?: VisitPin[];
  stops?: Stop[];
  gaps?: Gap[];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true })
      .setView([22.5, 79], 5); // India
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);

    // Leaflet needs a size refresh when its container appears/resizes.
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Redraw whenever data changes.
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    /* Route */
    if (route.length > 1) {
      const line = route.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      L.polyline(line, { color: "#1d4ed8", weight: 4, opacity: 0.85 }).addTo(g);
      bounds.push(...line);

      // GPS gaps: dashed red connector
      gaps.forEach((gp) => {
        const a = route.find((p) => p.at === gp.from);
        const b = route.find((p) => p.at === gp.to);
        if (a && b) {
          L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: "#e11d48", weight: 3, dashArray: "6 6" })
            .bindTooltip(`No GPS for ${fmtMins(gp.minutes)} (${fmtClock(gp.from)} – ${fmtClock(gp.to)})`)
            .addTo(g);
        }
      });

      const s = route[0], e = route[route.length - 1];
      L.marker([s.lat, s.lng], { icon: badge("S", "#0f766e", 24) })
        .bindTooltip(`Start · ${fmtClock(s.at)}`).addTo(g);
      L.marker([e.lat, e.lng], { icon: badge("E", "#7c3aed", 24) })
        .bindTooltip(`Last position · ${fmtClock(e.at)}`).addTo(g);
    } else if (route.length === 1) {
      const p = route[0];
      L.marker([p.lat, p.lng], { icon: badge("•", "#1d4ed8", 20) }).bindTooltip(fmtClock(p.at)).addTo(g);
      bounds.push([p.lat, p.lng]);
    }

    /* Stops */
    stops.forEach((st) => {
      L.circle([st.lat, st.lng], { radius: 60, color: "#d97706", weight: 2, fillOpacity: 0.15 })
        .bindTooltip(`Stopped ${fmtMins(st.minutes)} · ${fmtClock(st.from)} – ${fmtClock(st.to)}`)
        .addTo(g);
    });

    /* Visits */
    visits.forEach((v) => {
      L.marker([v.lat, v.lng], { icon: badge(String(v.n), VISIT_COLOR[v.state], 28), zIndexOffset: 500 })
        .bindPopup(`<b>${esc(v.title)}</b>${v.detail ? `<br/><span style="font-size:12px">${esc(v.detail)}</span>` : ""}`)
        .addTo(g);
      bounds.push([v.lat, v.lng]);
    });

    /* Live employees */
    live.forEach((p) => {
      const initials = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
      L.marker([p.lat, p.lng], { icon: badge(initials, LIVE_COLOR[p.state], 32), zIndexOffset: 1000 })
        .bindTooltip(`${p.name}${p.detail ? ` · ${p.detail}` : ""}`, { direction: "top", offset: [0, -14] })
        .on("click", () => selectRef.current?.(p.id))
        .addTo(g);
      bounds.push([p.lat, p.lng]);
    });

    if (bounds.length === 1) m.setView(bounds[0], 15);
    else if (bounds.length > 1) m.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 16 });
  }, [live, route, visits, stops, gaps]);

  return (
    <div className={`relative z-0 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
