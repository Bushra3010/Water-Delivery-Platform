"use client";

/* Stylised city map (SVG) standing in for Google Maps / Mapbox in the demo.
 * Same props a real map wrapper would take: markers, a route, service-area
 * overlays and a click handler. 100 map units = 1 km. */

import type { Locality, Pt } from "../lib/types";

export type MarkerKind = "home" | "vendor" | "driver" | "approx" | "pin" | "me";
export interface Marker { id: string; pt: Pt; kind: MarkerKind; label?: string }
export type Area =
  | { kind: "circle"; c: Pt; r: number; color: string; label?: string }
  | { kind: "poly"; pts: Pt[]; color: string; label?: string };

const RIVER = "M-400 -200 C 60 120, -40 420, 60 640 S 20 980, 80 1400";
const MAJOR_H = [100, 420, 650, 830];
const MAJOR_V = [130, 500, 820];

export default function CityMap({
  markers = [], route, areas = [], fit, height = 220, localities = [], onPick, radarAt, rounded = 18, showLabels = true,
}: {
  markers?: Marker[]; route?: Pt[]; areas?: Area[]; fit?: Pt[]; height?: number | string; localities?: Locality[];
  onPick?: (p: Pt) => void; radarAt?: Pt; rounded?: number; showLabels?: boolean;
}) {
  const pts = fit && fit.length ? fit : [{ x: 0, y: 0 }, { x: 1000, y: 1000 }];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const pad = 90;
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const minSpan = 320;
  if (x1 - x0 < minSpan) { const c = (x0 + x1) / 2; x0 = c - minSpan / 2; x1 = c + minSpan / 2; }
  if (y1 - y0 < minSpan) { const c = (y0 + y1) / 2; y0 = c - minSpan / 2; y1 = c + minSpan / 2; }
  const vbW = x1 - x0;
  const k = vbW / 360; // marker scale so pins stay the same size on screen

  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    onPick({ x: Math.round(p.x), y: Math.round(p.y) });
  };

  return (
    <div style={{ height, borderRadius: rounded, overflow: "hidden", background: "var(--map-land)", position: "relative" }}>
      <svg viewBox={`${x0} ${y0} ${vbW} ${y1 - y0}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%"
        onClick={click} style={{ display: "block", cursor: onPick ? "crosshair" : "default" }} role="img" aria-label="Map">
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="var(--map-land)" />
        {/* parks */}
        <path d="M560 470 h120 v90 h-120z" fill="var(--map-park)" />
        <path d="M180 560 h90 v70 h-90z" fill="var(--map-park)" />
        <path d="M850 150 h110 v120 h-110z" fill="var(--map-park)" />
        <ellipse cx="420" cy="170" rx="55" ry="35" fill="var(--map-park)" />
        {/* river */}
        <path d={RIVER} stroke="var(--map-water)" strokeWidth={70} fill="none" />
        {/* minor grid */}
        {Array.from({ length: 30 }, (_, i) => -400 + i * 100).map((v) => (
          <g key={v} stroke="var(--map-road)" strokeWidth={6}>
            <line x1={v} y1={-1000} x2={v} y2={2000} />
            <line x1={-1000} y1={v} x2={2000} y2={v} />
          </g>
        ))}
        {/* major roads & expressway */}
        {MAJOR_H.map((y) => <line key={`h${y}`} x1={-1000} y1={y} x2={2000} y2={y} stroke="var(--map-major)" strokeWidth={16} />)}
        {MAJOR_V.map((x) => <line key={`v${x}`} x1={x} y1={-1000} x2={x} y2={2000} stroke="var(--map-major)" strokeWidth={16} />)}
        <line x1={420} y1={560} x2={1400} y2={1500} stroke="var(--map-major)" strokeWidth={22} />

        {/* service areas */}
        {areas.map((a, i) => a.kind === "circle"
          ? <circle key={i} cx={a.c.x} cy={a.c.y} r={a.r} fill={a.color} fillOpacity={0.12} stroke={a.color} strokeWidth={2.5 * k} strokeDasharray={`${8 * k} ${6 * k}`} />
          : <polygon key={i} points={a.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill={a.color} fillOpacity={0.14} stroke={a.color} strokeWidth={2.5 * k} />)}

        {showLabels && localities.map((l) => (
          <text key={l.id} x={l.center.x} y={l.center.y - 18} textAnchor="middle" fontSize={11 * k} fontWeight={600} fill="#8a94a8">{l.name}</text>
        ))}

        {route && route.length > 1 && (
          <>
            <polyline points={route.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="white" strokeWidth={9 * k} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={route.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--blue)" strokeWidth={5 * k} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {radarAt && [1, 2, 3].map((n) => (
          <circle key={n} className={`radar r${n}`} cx={radarAt.x} cy={radarAt.y} r={90 * k} fill="var(--blue)" fillOpacity={0.18} stroke="var(--blue)" strokeOpacity={0.4} />
        ))}

        {markers.map((m) => <MarkerGlyph key={m.id} m={m} k={k} />)}
      </svg>
    </div>
  );
}

function MarkerGlyph({ m, k }: { m: Marker; k: number }) {
  const t = `translate(${m.pt.x} ${m.pt.y}) scale(${k})`;
  switch (m.kind) {
    case "approx":
      return (
        <g transform={t}>
          <circle r={13} fill="var(--blue)" fillOpacity={0.16} />
          <circle r={6} fill="var(--blue)" fillOpacity={0.75} stroke="white" strokeWidth={2} />
        </g>
      );
    case "driver":
      return (
        <g transform={t} className="map-marker">
          <circle r={16} fill="var(--blue)" fillOpacity={0.18} />
          <circle r={11} fill="var(--blue-dark)" stroke="white" strokeWidth={2.5} />
          <path d="M-5.5 -3h6.5v5.5h-6.5zM1 -1h2.8l1.8 2v1.5H1" fill="white" />
          {m.label && <Label text={m.label} y={-20} />}
        </g>
      );
    case "vendor":
      return (
        <g transform={t}>
          <rect x={-11} y={-11} width={22} height={22} rx={6} fill="var(--go)" stroke="white" strokeWidth={2.5} />
          <path d="M-5 -1h10v6h-10zM-6 -1l2-5h8l2 5" fill="white" />
          {m.label && <Label text={m.label} y={-18} />}
        </g>
      );
    case "me":
      return (
        <g transform={t}>
          <circle r={14} fill="var(--water)" fillOpacity={0.2} />
          <circle r={7} fill="var(--water)" stroke="white" strokeWidth={2.5} />
        </g>
      );
    case "pin":
    case "home":
    default:
      return (
        <g transform={t}>
          <path d="M0 0c-2-5-11-10-11-18a11 11 0 0 1 22 0c0 8-9 13-11 18z" fill={m.kind === "pin" ? "var(--red)" : "var(--go)"} stroke="white" strokeWidth={2} />
          <circle cy={-18} r={4.2} fill="white" />
          {m.label && <Label text={m.label} y={-36} />}
        </g>
      );
  }
}

function Label({ text, y }: { text: string; y: number }) {
  const w = Math.max(34, text.length * 5.8 + 12);
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x={-w / 2} y={-9} width={w} height={17} rx={8.5} fill="white" stroke="#e6eaf5" />
      <text y={3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#0f1729">{text}</text>
    </g>
  );
}
