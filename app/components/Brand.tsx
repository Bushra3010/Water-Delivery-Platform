/* Brand pieces. Names live in one place so the client can rename the product
 * without touching screens. */

export const BRAND = {
  name: "Water Delivery",
  tagline: "Pure Water. Healthier Tomorrow.",
  driverTagline: "Drive for a Cleaner Tomorrow",
  vendorPanel: "WaterPro",
  adminPanel: "AquaAdmin",
};

/** Water-drop mark. */
export function BrandMark({ size = 36, light }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={light ? "dropL" : "drop"} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light ? "#ffffff" : "#38bdf8"} />
          <stop offset="1" stopColor={light ? "#cfe7ff" : "#0b5cff"} />
        </linearGradient>
      </defs>
      <path d="M24 4C24 4 9 20.5 9 30a15 15 0 0 0 30 0C39 20.5 24 4 24 4z" fill={`url(#${light ? "dropL" : "drop"})`} />
      <path d="M17.5 30.5a6.8 6.8 0 0 0 6.5 6.4" stroke={light ? "#0b5cff" : "white"} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9" />
    </svg>
  );
}

export function Wordmark({ light, sub = BRAND.tagline }: { light?: boolean; sub?: string }) {
  return (
    <div style={{ lineHeight: 1.1 }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em", color: light ? "white" : "var(--blue-dark)" }}>{BRAND.name}</p>
      <p style={{ margin: "1px 0 0", fontSize: 10.5, fontWeight: 500, color: light ? "rgba(255,255,255,0.75)" : "var(--ink-soft)" }}>{sub}</p>
    </div>
  );
}
