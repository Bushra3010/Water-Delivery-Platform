"use client";

import AdSlot from "../components/AdSlot";
import CityMap from "../components/CityMap";
import ProductArt from "../components/ProductArt";
import { BellIcon, ChevronDown, ChevronRight, PhoneIcon, PinIcon, WhatsAppIcon } from "../components/icons";
import { PrimaryButton, SectionHead, StatusBadge, card, iconBtn, small } from "../components/ui";
import { greeting, t } from "../lib/i18n";
import { approx, eligibleVendors, fmtDate, inr, isOpen, quote, rankDrivers, walletBalance } from "../lib/logic";
import { useData, useNow } from "../lib/store";
import type { Address, Customer, DB } from "../lib/types";
import type { Nav } from "./CustomerApp";

export function currentAddress(db: DB, me: Customer, addrId: string | null): Address | undefined {
  const mine = db.addresses.filter((a) => a.customerId === me.id);
  return mine.find((a) => a.id === addrId) ?? mine.find((a) => a.isDefault) ?? mine[0];
}

export const spotOf = (a: Address) => ({ pt: a.pt, pin: a.pin, localityId: a.localityId });

/** The price a customer would pay for one unit of each SKU at this address. */
export function unitPrices(db: DB, a: Address | undefined, now: number) {
  const out: Record<string, number> = {};
  if (!a) return out;
  db.skus.forEach((s) => {
    const q = quote(db, spotOf(a), [{ skuId: s.id, qty: 1 }], 99, { now });
    if (!("error" in q)) out[s.id] = q.lines[0].price;
  });
  return out;
}

export default function HomeScreen({ me, nav, unread }: { me: Customer; nav: Nav; unread: number }) {
  const db = useData();
  const now = useNow(5000);
  const addr = currentAddress(db, me, nav.addrId);
  const spot = addr ? spotOf(addr) : null;
  const vendors = spot ? eligibleVendors(db, spot, [], now) : [];
  const serviceable = vendors.length > 0;
  const nearby = spot ? rankDrivers(db, spot, [], now) : [];
  const prices = unitPrices(db, addr, now);
  const active = db.orders.find((o) => o.customerId === me.id && isOpen(o) && o.status !== "Placed");
  const scheduled = db.orders.filter((o) => o.customerId === me.id && o.status === "Placed").sort((a, b) => (a.slot?.date ?? 0) - (b.slot?.date ?? 0))[0];
  const sub = db.subs.find((s) => s.customerId === me.id && s.status === "Active");
  const plan = sub ? db.plans.find((p) => p.id === sub.planId) : undefined;
  const L = (k: Parameters<typeof t>[1]) => t(me.lang, k);

  const quick = [
    { label: L("qOrder"), color: "var(--blue)", tint: "var(--blue-tint)", onClick: () => nav.push({ k: "order" }), icon: "🛒" },
    { label: L("qSubscribe"), color: "var(--gold-dark)", tint: "var(--gold-tint)", onClick: () => nav.goTab("plans"), icon: "🔁" },
    { label: L("qOrders"), color: "var(--purple)", tint: "var(--purple-tint)", onClick: () => nav.goTab("orders"), icon: "📦" },
    { label: L("qWallet"), color: "var(--go)", tint: "var(--success)", onClick: () => nav.push({ k: "wallet" }), icon: "👛" },
  ];

  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      {/* Greeting + bell */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 6px" }}>
        <div>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{L("hello")}, {me.name.split(" ")[0]} 👋</p>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{greeting(me.lang)}</p>
        </div>
        <button onClick={() => nav.push({ k: "notifications" })} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="press" style={iconBtn}>
          <BellIcon s={25} c="var(--text-secondary)" w={1.7} />
          {unread > 0 && <span style={{ position: "absolute", top: -6, right: -7, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 10, background: "var(--red)", border: "1.5px solid var(--app-bg)", color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>}
        </button>
      </div>

      {/* Address chip */}
      <button onClick={() => nav.push({ k: "addresses", select: true })} className="press" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: "2px 0 12px", cursor: "pointer", maxWidth: "100%" }}>
        <PinIcon s={16} c="var(--go)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {addr ? `${addr.label} · ${addr.line}` : "Add a delivery address"}
        </span>
        <ChevronDown s={14} c="var(--ink-soft)" />
      </button>

      {addr && !serviceable && (
        <div role="alert" style={{ ...card, padding: 14, marginBottom: 12, background: "var(--error)", boxShadow: "none" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--error-text)", fontSize: 14 }}>{L("notServiceable")}</p>
          <p style={{ ...small, color: "var(--error-text)" }}>{L("notServiceableBody")}</p>
        </div>
      )}

      {/* Live order banner */}
      {active && (
        <button onClick={() => nav.push({ k: "track", id: active.id })} className="press fade-up" style={{ ...card, width: "100%", border: "none", cursor: "pointer", textAlign: "left", padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg,var(--blue),var(--blue-dark))", color: "white" }}>
          <span className="animate-pulse-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: "#86efac", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>{L("activeOrder")} #{active.id}</p>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{statusLine(active.status)}</p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>{L("track")} <ChevronRight s={14} c="white" /></span>
        </button>
      )}

      {/* Hero */}
      <div style={{ borderRadius: 20, padding: "18px 16px", background: "linear-gradient(135deg,#dbeafe,#e0f2fe)", display: "flex", alignItems: "center", gap: 10, overflow: "hidden", position: "relative" }}>
        <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <p style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "var(--blue-dark)", lineHeight: 1.2, whiteSpace: "pre-line" }}>{L("heroTitle")}</p>
          <p style={{ margin: "6px 0 12px", fontSize: 12, color: "var(--ink-soft)" }}>{L("heroBody")}</p>
          <button onClick={() => nav.push({ k: "order" })} disabled={!serviceable} className="press" style={{ border: "none", borderRadius: 12, padding: "9px 14px", background: serviceable ? "var(--go)" : "var(--line-strong)", color: "white", fontWeight: 700, fontSize: 13, cursor: serviceable ? "pointer" : "not-allowed" }}>{L("orderNow")} →</button>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <ProductArt art="can20" size={92} />
          <div style={{ marginLeft: -26 }}><ProductArt art="jar" size={72} /></div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 16 }}>
        {quick.map((q) => (
          <button key={q.label} onClick={q.onClick} className="press" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <span style={{ width: 56, height: 56, borderRadius: 18, background: "var(--surface)", boxShadow: "0 6px 10px -2px rgba(15,23,41,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: q.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>{q.icon}</span>
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", textAlign: "center" }}>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Nearby drivers — approximate positions only before booking */}
      {addr && serviceable && (
        <>
          <SectionHead title={L("nearby")} />
          <div style={{ ...card, padding: 8 }}>
            <CityMap height={170} fit={[addr.pt, ...nearby.slice(0, 5).map((c) => c.driver.loc)]} localities={db.localities.filter((l) => l.cityId === "noida")} showLabels={false}
              markers={[{ id: "home", pt: addr.pt, kind: "home" }, ...nearby.slice(0, 8).map((c, i) => ({ id: c.driver.id, pt: approx(c.driver.loc, i + 1), kind: "approx" as const }))]} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 6px 4px" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{nearby.length ? `${nearby.length} driver${nearby.length > 1 ? "s" : ""} available nearby` : "All drivers busy right now"}</p>
              {nearby[0] && <p style={{ margin: 0, fontSize: 12, color: "var(--go)", fontWeight: 700 }}>~{Math.round(8 + nearby[0].km * 4)} min</p>}
            </div>
            <p style={{ ...small, fontSize: 11, padding: "0 6px 4px", margin: 0 }}>Locations are approximate until a driver accepts your order.</p>
          </div>
        </>
      )}

      {/* Subscription */}
      {sub && plan && (
        <>
          <SectionHead title={L("mySub")} onAll={() => nav.push({ k: "sub", id: sub.id })} allLabel="Manage" />
          <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <ProductArt art="can20" size={46} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{plan.name}</p>
              <p style={small}>{plan.entitlement + sub.carried - sub.used} of {plan.entitlement + sub.carried} cans left · till {fmtDate(sub.end)}</p>
            </div>
            <button onClick={() => nav.push({ k: "order", subId: sub.id })} className="press" disabled={!serviceable}
              style={{ border: "none", borderRadius: 10, padding: "8px 12px", background: "var(--blue-tint)", color: "var(--blue)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Use</button>
          </div>
        </>
      )}
      {scheduled?.slot && (
        <button onClick={() => nav.push({ k: "track", id: scheduled.id })} className="press" style={{ ...card, width: "100%", border: "none", textAlign: "left", cursor: "pointer", padding: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🗓️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Next delivery · {fmtDate(scheduled.slot.date)}</p>
            <p style={small}>{scheduled.items.map((i) => `${i.qty} × ${i.name}`).join(", ")} · {scheduled.slot.window}</p>
          </div>
          <StatusBadge status={scheduled.status} customer />
        </button>
      )}

      {/* Products */}
      <SectionHead title={L("popular")} onAll={() => nav.push({ k: "order" })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        {db.skus.map((s) => {
          const p = prices[s.id];
          return (
            <button key={s.id} onClick={() => nav.push({ k: "order", skuId: s.id })} disabled={p === undefined} className="press" style={{ ...card, border: "none", padding: 12, textAlign: "left", cursor: p === undefined ? "not-allowed" : "pointer", opacity: p === undefined ? 0.55 : 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: 76, borderRadius: 12, background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><ProductArt art={s.art} size={64} /></div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{s.name}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--blue-dark)" }}>{p !== undefined ? inr(p) : "Unavailable"}</span>
                {s.returnable && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--teal-text)", background: "var(--teal-bg)", borderRadius: 6, padding: "2px 6px" }}>Can exchange</span>}
              </div>
            </button>
          );
        })}
      </div>

      <AdSlot placement="homeBanner" />

      {/* Wallet + support */}
      <div style={{ ...card, padding: 14, marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{L("support")}</p>
          <p style={small}>Wallet {inr(walletBalance(db, me.id))} · {me.cansHeld} empty can{me.cansHeld === 1 ? "" : "s"} with you</p>
        </div>
        <a href={`tel:${db.settings.support.phone}`} aria-label={L("call")} style={{ width: 40, height: 40, borderRadius: 12, background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><PhoneIcon s={19} c="var(--blue)" /></a>
        <a href={`https://wa.me/${db.settings.support.whatsapp}`} target="_blank" rel="noreferrer" aria-label={L("whatsapp")} style={{ width: 40, height: 40, borderRadius: 12, background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}><WhatsAppIcon s={19} c="var(--go)" /></a>
      </div>

      {!addr && <div style={{ marginTop: 16 }}><PrimaryButton onClick={() => nav.push({ k: "addAddress" })}>Add delivery address</PrimaryButton></div>}
      <p style={{ textAlign: "center", fontSize: 11, color: "var(--ink-mute)", margin: "18px 0 0" }}>Serving {db.cities.filter((c) => c.active).map((c) => c.name).join(", ")} · more cities soon</p>
    </div>
  );
}

export function statusLine(s: string) {
  switch (s) {
    case "Searching": case "Assigned": return "Finding the nearest driver…";
    case "Accepted": return "Driver assigned — getting your water ready";
    case "Pickup": return "Loading your water at the vendor";
    case "Out for Delivery": return "Your driver is on the way";
    case "Arrived": return "Driver has arrived — share your OTP";
    default: return s;
  }
}
