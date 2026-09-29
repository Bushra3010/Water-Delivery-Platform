"use client";

import { useState } from "react";
import ProductArt from "../components/ProductArt";
import { RepeatIcon } from "../components/icons";
import { Chip, Empty, Footer, GhostButton, Line, PageHeader, Pill, PrimaryButton, StatusBadge, Toggle, card, label, small } from "../components/ui";
import { notify, placeOrder } from "../lib/actions";
import { DAY, eligibleVendors, fmtDT, fmtDate, inr, startOfDay, walletBalance } from "../lib/logic";
import { update, useData, useNow } from "../lib/store";
import type { Customer, CustomerSub, DB, Plan } from "../lib/types";
import type { Nav } from "./CustomerApp";
import { currentAddress, spotOf } from "./Home";
import { UpiSheet, slotHour } from "./Ordering";

const left = (s: CustomerSub, p: Plan) => p.entitlement + s.carried - s.used;
const ownerName = (db: DB, p: Plan) => (p.owner === "platform" ? "Water Delivery" : db.vendors.find((v) => v.id === p.owner)?.name ?? "Vendor");

export function PlansTab({ me, nav }: { me: Customer; nav: Nav }) {
  const db = useData();
  const now = useNow(30000);
  const addr = currentAddress(db, me, nav.addrId);
  const mine = db.subs.filter((s) => s.customerId === me.id).sort((a, b) => (a.status === "Active" ? -1 : 1) - (b.status === "Active" ? -1 : 1));
  const available = db.plans.filter((p) => p.active && addr && eligibleVendors(db, spotOf(addr), [p.skuId], now, p.owner === "platform" ? null : p.owner).length > 0);
  const upcoming = db.orders.filter((o) => o.customerId === me.id && o.subscriptionId && o.status === "Placed").sort((a, b) => (a.slot?.date ?? 0) - (b.slot?.date ?? 0));

  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      <h2 style={{ margin: "18px 2px 4px", fontSize: 20, fontWeight: 800 }}>My Subscriptions</h2>
      <p style={{ ...small, margin: "0 2px 12px" }}>Prepaid cans — order when you need or get them on a schedule.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mine.map((s) => {
          const p = db.plans.find((x) => x.id === s.planId)!;
          const total = p.entitlement + s.carried;
          return (
            <button key={s.id} onClick={() => nav.push({ k: "sub", id: s.id })} className="press" style={{ ...card, border: "none", cursor: "pointer", textAlign: "left", padding: 16, background: s.status === "Active" ? "linear-gradient(150deg,var(--blue-dark),var(--blue))" : "var(--surface)", color: s.status === "Active" ? "white" : "var(--ink)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{p.name}</p>
                <Pill tone={s.status === "Active" ? "green" : "grey"}>{s.status}</Pill>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.8 }}>{ownerName(db, p)} · {inr(p.price)} / {p.validityDays} days</p>
              <div style={{ height: 6, borderRadius: 3, background: s.status === "Active" ? "rgba(255,255,255,0.25)" : "var(--line)", margin: "12px 0 6px" }}>
                <div style={{ width: `${(s.used / Math.max(1, total)) * 100}%`, height: "100%", borderRadius: 3, background: "var(--gold)" }} />
              </div>
              <p style={{ margin: 0, fontSize: 12.5, opacity: 0.9 }}>{left(s, p)} of {total} left · used {s.used} · valid till {fmtDate(s.end)}</p>
            </button>
          );
        })}
        {!mine.length && <Empty title="No subscription yet" body="Save up to 20% with a monthly plan." />}
      </div>

      {upcoming.length > 0 && (
        <>
          <h3 style={{ margin: "22px 2px 10px", fontSize: 15.5, fontWeight: 700 }}>Upcoming Deliveries</h3>
          <div style={{ ...card, padding: "4px 14px" }}>
            {upcoming.map((o, i) => (
              <button key={o.id} onClick={() => nav.push({ k: "track", id: o.id })} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", width: "100%", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span style={{ fontSize: 18 }}>🗓️</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{fmtDate(o.slot!.date)} · {o.slot!.window}</span>
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{o.items.map((x) => `${x.qty} × ${x.name.replace(" Water Can", "")}`).join(", ")}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h3 style={{ margin: "22px 2px 10px", fontSize: 15.5, fontWeight: 700 }}>Plans for your area</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {available.map((p) => (
          <button key={p.id} onClick={() => nav.push({ k: "plan", id: p.id })} className="press" style={{ ...card, border: "none", cursor: "pointer", textAlign: "left", padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><ProductArt art={db.skus.find((s) => s.id === p.skuId)!.art} size={44} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.name}</p>
              <p style={{ ...small, margin: 0, fontSize: 12 }}>{p.entitlement} × {db.skus.find((s) => s.id === p.skuId)!.name} · {p.mode}</p>
              <p style={{ ...small, margin: 0, fontSize: 11 }}>by {ownerName(db, p)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--blue-dark)" }}>{inr(p.price)}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: "var(--ink-mute)" }}>/{p.validityDays} days</p>
            </div>
          </button>
        ))}
        {!available.length && <Empty title="No plans for this address yet" body="Plans appear here once a partner near you offers them." />}
      </div>
    </div>
  );
}

export function PlanDetailPage({ id, me, nav }: { id: string; me: Customer; nav: Nav }) {
  const db = useData();
  const now = useNow(30000);
  const p = db.plans.find((x) => x.id === id)!;
  const sku = db.skus.find((s) => s.id === p.skuId)!;
  const addr = currentAddress(db, me, nav.addrId);
  const [mode, setMode] = useState<"On-demand" | "Scheduled">(p.mode === "Scheduled" ? "Scheduled" : "On-demand");
  const [every, setEvery] = useState<"Daily" | "Alternate days" | "Weekly">(p.maxPerDay === 1 && p.entitlement >= 28 ? "Daily" : "Weekly");
  const [windowV, setWindowV] = useState(db.settings.slots[0]);
  const [auto, setAuto] = useState(p.autoRenew);
  const [pay, setPay] = useState<"UPI" | "Wallet">("UPI");
  const [upi, setUpi] = useState(false);
  const wallet = walletBalance(db, me.id);
  const already = db.subs.find((s) => s.customerId === me.id && s.planId === p.id && s.status === "Active");
  const regular = db.products.filter((x) => x.skuId === p.skuId && x.active).map((x) => x.price);
  const saving = regular.length ? Math.round((1 - p.price / (Math.min(...regular) * p.entitlement)) * 100) : 0;

  const activate = () => {
    if (!addr) return;
    const subId = `cs${Date.now()}`;
    const t = Date.now();
    update((d) => {
      d.subs.unshift({
        id: subId, customerId: me.id, planId: p.id, start: t, end: t + p.validityDays * DAY, used: 0, carried: 0, autoRenew: auto && p.autoRenew, status: "Active",
        schedule: mode === "Scheduled" ? { every, qty: 1, window: windowV } : null,
        ledger: [{ at: t, delta: p.entitlement, note: `Plan activated · paid ${inr(p.price)} via ${pay}` }],
      });
      if (pay === "Wallet") d.wallet.unshift({ id: `w${t}`, customerId: me.id, amount: -p.price, title: `Subscription · ${p.name}`, at: t });
      notify(d, `customer:${me.id}`, "Subscription active", `${p.name} is active till ${fmtDate(t + p.validityDays * DAY)}.`);
      if (p.owner !== "platform") notify(d, `vendor:${p.owner}`, "New subscriber", `${me.name} subscribed to ${p.name}.`);
    });
    if (mode === "Scheduled") {
      const step = every === "Daily" ? 1 : every === "Alternate days" ? 2 : 7;
      [1, 1 + step].forEach((dd) => {
        placeOrder({
          customerId: me.id, addressId: addr.id, lines: [{ skuId: sku.id, name: sku.name, qty: 1, price: 0 }], subtotal: 0, tax: 0, deliveryFee: 0, deposit: 0, discount: 0, coupon: null, total: 0,
          method: "Subscription", type: "Scheduled", slot: { date: startOfDay(now + dd * DAY) + slotHour(windowV) * 3600000, window: windowV },
          subscriptionId: subId, routing: "platform", cansExpected: sku.returnable ? 1 : 0,
        });
      });
    }
    nav.flash("Subscription activated!");
    nav.replace({ k: "sub", id: subId });
  };

  return (
    <div className="fade-up">
      <PageHeader title={p.name} onBack={nav.back} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ borderRadius: 20, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            {saving > 0 && <span style={{ background: "var(--gold)", color: "var(--blue-dark)", fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 8 }}>SAVE {saving}%</span>}
            <p style={{ margin: "10px 0 2px", fontSize: 26, fontWeight: 800 }}>{inr(p.price)}<span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}> / {p.validityDays} days</span></p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>{p.entitlement} × {sku.name}</p>
          </div>
          <ProductArt art={sku.art} size={80} />
        </div>
        <div style={{ ...card, padding: 14 }}>
          <p style={small}>{p.desc}</p>
          <Line k="Offered by" v={ownerName(db, p)} />
          <Line k="Delivery" v={p.mode} />
          <Line k="Limit" v={p.maxPerDay ? `${p.maxPerDay} per day` : "No daily limit"} />
          <Line k="Unused cans" v={p.unused === "Carry forward" ? "Carry forward to next cycle" : "Expire at end of cycle"} />
          <Line k="Auto-renew" v={p.autoRenew ? "Available" : "Manual renewal"} />
        </div>

        {already ? (
          <PrimaryButton onClick={() => nav.replace({ k: "sub", id: already.id })}>You already have this plan — manage</PrimaryButton>
        ) : (
          <>
            {p.mode === "Both" && (
              <div style={{ ...card, padding: 14 }}>
                <p style={label}>How do you want deliveries?</p>
                <div style={{ display: "flex", gap: 8 }}>{(["On-demand", "Scheduled"] as const).map((m) => <Chip key={m} on={mode === m} onClick={() => setMode(m)}>{m === "On-demand" ? "When I order" : "On a schedule"}</Chip>)}</div>
              </div>
            )}
            {mode === "Scheduled" && (
              <div style={{ ...card, padding: 14 }}>
                <p style={label}>Repeat</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(["Daily", "Alternate days", "Weekly"] as const).map((e) => <Chip key={e} on={every === e} onClick={() => setEvery(e)}>{e}</Chip>)}</div>
                <p style={{ ...label, marginTop: 12 }}>Time slot</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{db.settings.slots.map((w) => <Chip key={w} on={windowV === w} onClick={() => setWindowV(w)}>{w}</Chip>)}</div>
                <p style={{ ...small, fontSize: 11.5, marginTop: 8 }}>First delivery tomorrow. The next two deliveries are booked right away.</p>
              </div>
            )}
            <div style={{ ...card, padding: 14 }}>
              {p.autoRenew && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>Auto-renew</p><p style={{ ...small, margin: 0, fontSize: 11.5 }}>Needs a UPI AutoPay mandate. Reminder {db.settings.notify.renewalDaysBefore} days before.</p></div>
                <Toggle on={auto} onChange={setAuto} label="Auto-renew" />
              </div>}
              <p style={label}>Pay with</p>
              <div style={{ display: "flex", gap: 8 }}>
                <Chip on={pay === "UPI"} onClick={() => setPay("UPI")}>UPI</Chip>
                <Chip on={pay === "Wallet"} disabled={wallet < p.price} onClick={() => setPay("Wallet")}>Wallet ({inr(wallet)})</Chip>
              </div>
            </div>
          </>
        )}
      </div>
      {!already && <Footer><PrimaryButton tone="go" disabled={!addr} onClick={() => (pay === "UPI" ? setUpi(true) : activate())}>Subscribe · {inr(p.price)}</PrimaryButton></Footer>}
      {upi && <UpiSheet amount={p.price} payee={ownerName(db, p)} onClose={() => setUpi(false)} onPaid={activate} />}
    </div>
  );
}

export function SubDetailPage({ id, me, nav }: { id: string; me: Customer; nav: Nav }) {
  const db = useData();
  const [upi, setUpi] = useState(false);
  const s = db.subs.find((x) => x.id === id);
  if (!s) return null;
  const p = db.plans.find((x) => x.id === s.planId)!;
  const total = p.entitlement + s.carried;
  const orders = db.orders.filter((o) => o.subscriptionId === s.id).slice(0, 8);

  const setSub = (patch: Partial<CustomerSub>) => update((d) => { Object.assign(d.subs.find((x) => x.id === s.id)!, patch); });
  const renew = () => {
    const t = Date.now();
    update((d) => {
      const x = d.subs.find((y) => y.id === s.id)!;
      const carry = p.unused === "Carry forward" ? Math.max(0, p.entitlement + x.carried - x.used) : 0;
      const from = x.status === "Active" ? x.end : t;
      x.start = from; x.end = from + p.validityDays * DAY; x.used = 0; x.carried = carry; x.status = "Active";
      x.ledger.push({ at: t, delta: p.entitlement + carry, note: `Renewed · paid ${inr(p.price)}${carry ? ` · ${carry} carried forward` : ""}` });
      notify(d, `customer:${me.id}`, "Subscription renewed", `${p.name} is valid till ${fmtDate(x.end)}.`);
    });
    nav.flash("Plan renewed");
  };

  return (
    <div className="fade-up" style={{ paddingBottom: 24 }}>
      <PageHeader title={p.name} onBack={nav.back} right={<Pill tone={s.status === "Active" ? "green" : "grey"}>{s.status}</Pill>} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", textAlign: "center", gap: 6 }}>
            {[["Total", total], ["Used", s.used], ["Left", left(s, p)]].map(([k, v]) => (
              <div key={k}><p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: k === "Left" ? "var(--go)" : "var(--ink)" }}>{v}</p><p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-mute)" }}>{k}</p></div>
            ))}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--line)", margin: "12px 0 8px" }}>
            <div style={{ width: `${(s.used / Math.max(1, total)) * 100}%`, height: "100%", borderRadius: 3, background: "var(--blue)" }} />
          </div>
          <p style={{ ...small, margin: 0, textAlign: "center" }}>{fmtDate(s.start)} → {fmtDate(s.end)}{s.carried ? ` · includes ${s.carried} carried forward` : ""}</p>
        </div>

        {s.status === "Active" && <PrimaryButton tone="go" disabled={left(s, p) <= 0} onClick={() => nav.push({ k: "order", subId: s.id })}>Order from plan</PrimaryButton>}

        <div style={{ ...card, padding: 14 }}>
          {s.schedule && <Line k="Schedule" v={`${s.schedule.every} · ${s.schedule.qty} can · ${s.schedule.window}`} />}
          {p.autoRenew ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}><RepeatIcon s={16} c="var(--blue)" /> Auto-renew</span>
              <Toggle on={s.autoRenew} onChange={(v) => { setSub({ autoRenew: v }); nav.flash(v ? "Auto-renew on" : "Auto-renew off"); }} label="Auto-renew" />
            </div>
          ) : <Line k="Renewal" v="Manual" />}
        </div>
        <GhostButton onClick={() => setUpi(true)}>Renew now · {inr(p.price)}</GhostButton>

        <h3 style={{ margin: "8px 2px 0", fontSize: 15, fontWeight: 700 }}>Deliveries</h3>
        <div style={{ ...card, padding: "4px 14px" }}>
          {orders.map((o, i) => (
            <button key={o.id} onClick={() => nav.push({ k: "track", id: o.id })} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", width: "100%", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <span style={{ flex: 1, fontSize: 13 }}>#{o.id} · {o.slot ? `${fmtDate(o.slot.date)} ${o.slot.window}` : fmtDT(o.createdAt)}</span>
              <StatusBadge status={o.status} customer />
            </button>
          ))}
          {!orders.length && <p style={small}>No deliveries yet.</p>}
        </div>

        <h3 style={{ margin: "8px 2px 0", fontSize: 15, fontWeight: 700 }}>Usage ledger</h3>
        <div style={{ ...card, padding: "4px 14px" }}>
          {[...s.ledger].reverse().map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{l.note}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)" }}>{fmtDT(l.at)}{l.orderId ? ` · #${l.orderId}` : ""}</p>
              </div>
              <span style={{ fontWeight: 800, color: l.delta > 0 ? "var(--success-text)" : "var(--ink)" }}>{l.delta > 0 ? "+" : ""}{l.delta}</span>
            </div>
          ))}
        </div>
        {s.status === "Active" && (
          <GhostButton danger onClick={() => { setSub({ status: "Cancelled", autoRenew: false }); nav.flash("Subscription cancelled"); }}>Cancel subscription</GhostButton>
        )}
      </div>
      {upi && <UpiSheet amount={p.price} payee={ownerName(db, p)} onClose={() => setUpi(false)} onPaid={() => { setUpi(false); renew(); }} />}
    </div>
  );
}
