"use client";

/* Placeholder for a Google Mobile Ads (AdMob) unit. The Android build renders
 * the real banner/native ad here; placements are toggled by the Super Admin.
 * Never used on payment, tracking or support screens. */

import { useData } from "../lib/store";

export default function AdSlot({ placement }: { placement: "homeBanner" | "ordersNative" }) {
  const { settings } = useData();
  if (!settings.ads.enabled || !settings.ads[placement]) return null;
  const native = placement === "ordersNative";
  return (
    <div aria-label="Advertisement" style={{
      margin: "18px 0 0", borderRadius: 14, border: "1px dashed var(--line-strong)", background: "var(--surface)",
      padding: native ? 12 : "10px 12px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--gold-dark)", background: "var(--gold-tint)", borderRadius: 4, padding: "2px 5px" }}>Ad</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{native ? "Native ad" : "Banner ad"} · Google AdMob</p>
        <p style={{ margin: 0, fontSize: 10.5, color: "var(--ink-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{settings.ads.unitId}</p>
      </div>
    </div>
  );
}
