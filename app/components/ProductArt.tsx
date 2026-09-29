/* Flat product illustrations — no image assets needed for the demo. */

import type { Art } from "../lib/types";

export default function ProductArt({ art, size = 64 }: { art: Art; size?: number }) {
  const w = size, h = size;
  switch (art) {
    case "can20":
    case "jar":
      return (
        <svg width={w} height={h} viewBox="0 0 64 64" aria-hidden="true">
          <rect x="25" y="4" width="14" height="7" rx="2" fill={art === "jar" ? "#1d4ed8" : "#0b5cff"} />
          <rect x="27" y="10" width="10" height="5" fill="#93c5fd" />
          <path d="M16 22c0-4 4-7 8-7h16c4 0 8 3 8 7v32c0 4-3 6-6 6H22c-3 0-6-2-6-6z" fill="#bfdbfe" />
          <path d="M16 30h32v4H16zM16 44h32v4H16z" fill="#93c5fd" />
          <path d="M22 20c-2 1-3 3-3 5v24" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          {art === "jar" && <rect x="22" y="35" width="20" height="8" rx="2" fill="#1d4ed8" />}
          {art === "jar" && <text x="32" y="41.5" fontSize="5.5" fontWeight="700" textAnchor="middle" fill="white">BRAND</text>}
        </svg>
      );
    case "can10":
      return (
        <svg width={w} height={h} viewBox="0 0 64 64" aria-hidden="true">
          <rect x="27" y="12" width="10" height="6" rx="2" fill="#0b5cff" />
          <path d="M19 26c0-3 3-7 7-7h12c4 0 7 4 7 7v26c0 3-2 5-5 5H24c-3 0-5-2-5-5z" fill="#bfdbfe" />
          <path d="M19 34h26v3H19zM19 45h26v3H19z" fill="#93c5fd" />
          <path d="M45 30h4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-4" stroke="#93c5fd" strokeWidth="3" fill="none" />
        </svg>
      );
    case "carton":
      return (
        <svg width={w} height={h} viewBox="0 0 64 64" aria-hidden="true">
          {[14, 24, 34, 44].map((x) => (
            <g key={x}>
              <rect x={x + 2} y="10" width="4" height="4" rx="1" fill="#0b5cff" />
              <path d={`M${x} 18c0-2 1-4 3-4h2c2 0 3 2 3 4v14H${x}z`} fill="#bae6fd" />
            </g>
          ))}
          <rect x="10" y="30" width="44" height="26" rx="3" fill="#d6b27c" />
          <rect x="10" y="30" width="44" height="6" fill="#c49a5e" />
          <text x="32" y="50" fontSize="8" fontWeight="700" textAnchor="middle" fill="#7c5a2a">12 × 1L</text>
        </svg>
      );
    case "bottle":
    default:
      return (
        <svg width={w} height={h} viewBox="0 0 64 64" aria-hidden="true">
          {[18, 30, 42].map((x, i) => (
            <g key={x} transform={`translate(0 ${i === 1 ? -3 : 0})`}>
              <rect x={x - 2} y="10" width="8" height="5" rx="1.5" fill="#0b5cff" />
              <path d={`M${x - 3} 20c0-3 2-5 4-5h2c2 0 4 2 4 5v34c0 2-1 3-3 3h-4c-2 0-3-1-3-3z`} fill="#bae6fd" />
              <rect x={x - 3} y="32" width="10" height="9" fill="#38bdf8" />
            </g>
          ))}
        </svg>
      );
  }
}
