"use client";

import { useState } from "react";
import CityMap from "../components/CityMap";
import ProductArt from "../components/ProductArt";
import { CanIcon, CheckIcon, EditIcon, PinIcon, PlusIcon, TagIcon, TrashIcon } from "../components/icons";
import { BottomSheet, Chip, Footer, Line, PageHeader, Pill, PrimaryButton, Stepper, card, field, label, small } from "../components/ui";
import { placeOrder } from "../lib/actions";
import { t } from "../lib/i18n";
import { DAY, eligibleVendors, inr, quote, startOfDay, walletBalance } from "../lib/logic";
import { update, useData, useNow } from "../lib/store";
import type { Address, Customer, PayMethod } from "../lib/types";
import type { Nav } from "./CustomerApp";
import { currentAddress, spotOf, unitPrices } from "./Home";

/** "4–6 PM" → 16 */
export function slotHour(w: string) {
  const m = w.match(/^(\d+)/);
  const first = Number(m?.[1] ?? 9);
  const own = w.split("–")[0].match(/AM|PM/)?.[0];
  const ampm = own ?? w.match(/AM|PM/g)?.pop() ?? "AM";
  return ampm === "PM" && first < 12 ? first + 12 : first;
}

export function OrderPage({ me, nav, initialSku, subId }: { me: Customer; nav: Nav; initialSku?: string; subId?: string }) {
  const db = useData();
  const now = useNow(15000);
  const addr = currentAddress(db, me, nav.addrId);
  const sub = subId ? db.subs.find((s) => s.id === subId) : undefined;
  const plan = sub ? db.plans.find((p) => p.id === sub.planId) : undefined;

  const [qty, setQty] = useState<Record<string, number>>(() => ({ [plan?.skuId ?? initialSku ?? "s20"]: 1 }));
  const [type, setType] = useState<"Immediate" | "Scheduled">(plan?.mode === "Scheduled" ? "Scheduled" : "Immediate");
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>(plan ? "Subscription" : db.settings.payModes.cod ? "COD" : "UPI");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!addr) {
    return (
      <div><PageHeader title="Order Water" onBack={nav.back} />
        <div style={{ padding: 16 }}><PrimaryButton onClick={() => nav.replace({ k: "addAddress" })}>Add a delivery address first</PrimaryButton></div>
      </div>
    );
  }

  const cart = Object.entries(qty).map(([skuId, q]) => ({ skuId, qty: q })).filter((l) => l.qty > 0);
  const q = quote(db, spotOf(addr), cart, me.cansHeld, { couponCode: coupon, subscription: plan ?? null, now });
  const prices = unitPrices(db, addr, now);
  const wallet = walletBalance(db, me.id);

  const remaining = sub && plan ? plan.entitlement + sub.carried - sub.used : 0;
  const slotDate = (w: string) => startOfDay(now + day * DAY) + slotHour(w) * 3600000;
  const dayKey = type === "Scheduled" ? startOfDay(now + day * DAY) : startOfDay(now);
  const usedThatDay = sub ? db.orders.filter((o) => o.subscriptionId === sub.id && o.status !== "Cancelled" && o.status !== "Failed Assignment"
    && startOfDay(o.slot?.date ?? o.createdAt) === dayKey).reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0) : 0;
  const subMax = plan ? Math.max(0, Math.min(remaining, plan.maxPerDay ? plan.maxPerDay - usedThatDay : remaining)) : 20;
  const totalQty = cart.reduce((s, l) => s + l.qty, 0);

  const scheduleOk = type === "Immediate" || !!slot;
  const payOk = method !== "Wallet" || ("error" in q ? false : wallet >= q.total);
  const subOk = !plan || (totalQty > 0 && totalQty <= subMax);
  const canPlace = !("error" in q) && scheduleOk && payOk && subOk && totalQty > 0;

  const place = () => {
    if ("error" in q) return;
    const id = placeOrder({
      customerId: me.id, addressId: addr.id, lines: q.lines, subtotal: q.subtotal, tax: q.tax, deliveryFee: q.deliveryFee, deposit: q.deposit,
      discount: q.discount, coupon: q.discount ? coupon : null, total: q.total, method,
      type, slot: type === "Scheduled" && slot ? { date: slotDate(slot), window: slot } : null,
      subscriptionId: sub?.id ?? null, routing: method === "UPI" ? q.vendor.paymentMode : "platform", cansExpected: q.cansExpected,
    });
    nav.replace({ k: "track", id });
  };

  const submit = () => {
    setErr(null);
    if (!canPlace) return;
    if (method === "UPI") setPaying(true); else place();
  };

  const coupons = db.coupons.filter((c) => c.active && c.validTill > now && c.used < c.limit);
  const skus = plan ? db.skus.filter((s) => s.id === plan.skuId) : db.skus;

  return (
    <div className="fade-up">
      <PageHeader title={plan ? `Use ${plan.name}` : "Order Water"} onBack={nav.back} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Address */}
        <button onClick={() => nav.push({ k: "addresses", select: true })} className="press" style={{ ...card, border: "none", textAlign: "left", cursor: "pointer", padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <PinIcon s={20} c="var(--go)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-mute)", fontWeight: 600 }}>{t(me.lang, "deliverTo")} · {addr.label}</p>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{addr.line}{addr.landmark ? `, ${addr.landmark}` : ""}</p>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--blue)", fontWeight: 700 }}>Change</span>
        </button>

        {"error" in q && totalQty > 0 && <div role="alert" style={{ ...card, padding: 12, background: "var(--error)", boxShadow: "none", color: "var(--error-text)", fontSize: 13, fontWeight: 600 }}>{q.error}</div>}

        {/* Products */}
        <div style={{ ...card, padding: "6px 14px" }}>
          {skus.map((s, i) => {
            const p = prices[s.id];
            const n = qty[s.id] ?? 0;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "none", opacity: p === undefined ? 0.5 : 1 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ProductArt art={s.art} size={46} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{s.name}</p>
                  <p style={{ ...small, margin: 0, fontSize: 12 }}>{plan ? "Covered by plan" : p !== undefined ? `${inr(p)} · ${s.size}` : "Not available here"}</p>
                </div>
                {p !== undefined && <Stepper value={n} max={plan ? subMax : 20} onChange={(v) => setQty((x) => ({ ...x, [s.id]: v }))} />}
              </div>
            );
          })}
        </div>
        {plan && sub && (
          <p style={{ ...small, margin: "-4px 4px 0" }}>{remaining} of {plan.entitlement + sub.carried} cans left{plan.maxPerDay ? ` · max ${plan.maxPerDay}/day (${usedThatDay} used that day)` : ""}</p>
        )}

        {/* Delivery type */}
        <div style={{ ...card, padding: 14 }}>
          <p style={{ ...label, marginBottom: 10 }}>Delivery type</p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Immediate", "Scheduled"] as const).filter((x) => !plan || plan.mode === "Both" || (x === "Immediate" ? plan.mode === "On-demand" : plan.mode === "Scheduled")).map((x) => (
              <button key={x} onClick={() => setType(x)} aria-pressed={type === x} style={{
                flex: 1, borderRadius: 12, padding: "10px 8px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                border: `1.5px solid ${type === x ? "var(--blue)" : "var(--line-strong)"}`, background: type === x ? "var(--blue)" : "var(--surface)", color: type === x ? "white" : "var(--ink)",
              }}>{x === "Immediate" ? "⚡ Immediate" : "🗓️ Scheduled"}</button>
            ))}
          </div>
          {type === "Immediate" && !("error" in q) && (
            <p style={{ ...small, marginTop: 10 }}>{q.etaMin ? `Arrives in about ${q.etaMin} minutes · ${q.driversNearby} driver${q.driversNearby > 1 ? "s" : ""} nearby` : "All drivers are busy — we'll keep searching for a few minutes."}</p>
          )}
          {type === "Scheduled" && (
            <div className="fade-up" style={{ marginTop: 12 }}>
              <div className="no-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const dt = new Date(now + d * DAY);
                  return (
                    <Chip key={d} on={day === d} onClick={() => { setDay(d); setSlot(null); }}>
                      <span style={{ display: "block", fontSize: 10.5, fontWeight: 500 }}>{d === 0 ? "Today" : d === 1 ? "Tomorrow" : dt.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                      {dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </Chip>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {db.settings.slots.map((w) => {
                  const past = slotDate(w) < now + 60 * 60000;
                  return <Chip key={w} on={slot === w} disabled={past} onClick={() => setSlot(w)}>{w}</Chip>;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Can exchange */}
        {!("error" in q) && q.cansExpected > 0 && (
          <div style={{ ...card, padding: 14, display: "flex", gap: 12, background: "var(--teal-bg)", boxShadow: "none", border: "1px solid var(--teal-border)" }}>
            <CanIcon s={22} c="var(--teal-text)" />
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--teal-text)" }}>Empty can exchange</p>
              <p style={{ ...small, color: "var(--text-secondary)" }}>
                Keep {Math.min(me.cansHeld, q.cansExpected)} empty can{Math.min(me.cansHeld, q.cansExpected) === 1 ? "" : "s"} ready for the driver.
                {q.newCans > 0 && ` ${q.newCans} new can${q.newCans > 1 ? "s" : ""} need a refundable deposit of ${inr(db.settings.canDeposit)} each.`}
              </p>
            </div>
          </div>
        )}

        {/* Payment */}
        {!plan && (
          <div style={{ ...card, padding: 14 }}>
            <p style={{ ...label, marginBottom: 10 }}>Payment method</p>
            {([
              { id: "COD", name: "Cash on Delivery", sub: "Pay the driver in cash", on: db.settings.payModes.cod },
              { id: "UPI", name: "UPI (Google Pay / PhonePe)", sub: "Pay securely online", on: db.settings.payModes.upi },
              { id: "Wallet", name: "Wallet", sub: `Balance ${inr(wallet)}`, on: db.settings.payModes.wallet },
            ] as const).filter((m) => m.on).map((m) => {
              const on = method === m.id;
              const short = m.id === "Wallet" && !("error" in q) && wallet < q.total;
              return (
                <button key={m.id} onClick={() => setMethod(m.id)} aria-pressed={on} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", border: "none", background: "none", cursor: "pointer", textAlign: "left", borderTop: m.id !== "COD" ? "1px solid var(--line)" : "none",
                }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${on ? "var(--blue)" : "var(--line-strong)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {on && <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--blue)" }} />}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{m.name}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: short ? "var(--error-text)" : "var(--ink-mute)" }}>{short ? `Insufficient balance (${inr(wallet)})` : m.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Coupon */}
        {!plan && (
          <div style={{ ...card, padding: 14 }}>
            <p style={{ ...label, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><TagIcon s={16} c="var(--gold-dark)" /> Apply coupon</p>
            {coupon && !("error" in q) && !q.couponError ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--success)", borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success-text)" }}>{coupon} applied · you save {inr(q.discount)}</span>
                <button onClick={() => { setCoupon(null); setCode(""); }} style={{ background: "none", border: "none", color: "var(--error-text)", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>Remove</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" aria-label="Coupon code" style={{ ...field, padding: "10px 12px" }} />
                  <button onClick={() => setCoupon(code.trim() || null)} disabled={!code.trim()} style={{ border: "none", borderRadius: 12, padding: "0 16px", background: code.trim() ? "var(--blue)" : "var(--line-strong)", color: "white", fontWeight: 700, cursor: "pointer" }}>Apply</button>
                </div>
                {coupon && !("error" in q) && q.couponError && <p role="alert" style={{ margin: "6px 2px 0", fontSize: 12, color: "var(--error-text)", fontWeight: 600 }}>{q.couponError}</p>}
                <div className="no-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10 }}>
                  {coupons.map((c) => (
                    <button key={c.code} onClick={() => { setCode(c.code); setCoupon(c.code); }} style={{ flexShrink: 0, border: "1px dashed var(--gold)", background: "var(--gold-tint)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--gold-dark)" }}>{c.code}</span>
                      <span style={{ display: "block", fontSize: 10.5, color: "var(--ink-soft)", maxWidth: 170 }}>{c.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bill */}
        {!("error" in q) && (
          <div style={{ ...card, padding: 14 }}>
            <p style={{ ...label, marginBottom: 6 }}>Bill details</p>
            {q.lines.map((l) => <Line key={l.skuId} k={`${l.qty} × ${l.name}`} v={plan ? "Plan" : inr(l.price * l.qty)} />)}
            {q.discount > 0 && <Line k={`Coupon ${coupon}`} v={`− ${inr(q.discount)}`} tone="var(--success-text)" />}
            {q.tax > 0 && <Line k={`GST (${q.vendor.gstRate}%)`} v={inr(q.tax)} />}
            <Line k="Delivery fee" v={q.deliveryFee ? inr(q.deliveryFee) : "Free"} />
            {q.deposit > 0 && <Line k={`Can deposit (${q.newCans} × ${inr(db.settings.canDeposit)}, refundable)`} v={inr(q.deposit)} />}
            <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "8px 0 4px" }} />
            <Line k="To pay" v={inr(q.total)} strong />
            <p style={{ ...small, fontSize: 11, marginTop: 6 }}>Fulfilled by the nearest available partner — the vendor is chosen automatically.</p>
          </div>
        )}
        {err && <p role="alert" style={{ margin: 0, color: "var(--error-text)", fontSize: 13, fontWeight: 600 }}>{err}</p>}
      </div>

      <Footer>
        <PrimaryButton tone="go" disabled={!canPlace} onClick={submit}>
          {"error" in q ? "Select products" : !scheduleOk ? "Pick a delivery slot" : plan ? `Book ${totalQty} from plan` : method === "UPI" ? `${t(me.lang, "proceed")} · ${inr(q.total)}` : `${t(me.lang, "placeOrder")} · ${inr(q.total)}`}
        </PrimaryButton>
      </Footer>

      {paying && !("error" in q) && <UpiSheet amount={q.total} payee={q.vendor.paymentMode === "direct" ? q.vendor.name : "Water Delivery (platform)"} onClose={() => setPaying(false)} onPaid={place} />}
    </div>
  );
}

/** Stand-in for the payment gateway's UPI intent flow. */
export function UpiSheet({ amount, payee, onClose, onPaid }: { amount: number; payee: string; onClose: () => void; onPaid: () => void }) {
  const [state, setState] = useState<"pick" | "processing" | "done">("pick");
  const [app, setApp] = useState("Google Pay");
  const pay = () => {
    setState("processing");
    setTimeout(() => setState("done"), 1300);
    setTimeout(onPaid, 2000);
  };
  return (
    <BottomSheet title="Pay with UPI" onClose={state === "pick" ? onClose : () => undefined}>
      {state === "pick" && (
        <>
          <div style={{ ...card, padding: 14, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>Paying to {payee}</p>
            <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800 }}>{inr(amount)}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0 14px" }}>
            {["Google Pay", "PhonePe", "Paytm", "BHIM UPI"].map((a) => (
              <Chip key={a} on={app === a} onClick={() => setApp(a)}>{a}</Chip>
            ))}
          </div>
          <PrimaryButton tone="go" onClick={pay}>Pay {inr(amount)}</PrimaryButton>
          <p style={{ ...small, textAlign: "center", fontSize: 11, marginTop: 8 }}>Demo gateway — no money moves. Card/UPI details stay with the payment provider.</p>
        </>
      )}
      {state !== "pick" && (
        <div style={{ padding: "28px 0 20px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto", background: state === "done" ? "var(--go)" : "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {state === "done" ? <CheckIcon s={32} c="white" /> : <span className="animate-pulse-dot" style={{ fontSize: 26 }}>⏳</span>}
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 16, fontWeight: 700 }}>{state === "done" ? "Payment successful" : `Waiting for ${app}…`}</p>
        </div>
      )}
    </BottomSheet>
  );
}

/* ───────────────────────── Addresses ───────────────────────── */

export function AddressesPage({ me, nav, select }: { me: Customer; nav: Nav; select?: boolean }) {
  const db = useData();
  const now = useNow(30000);
  const mine = db.addresses.filter((a) => a.customerId === me.id);
  const current = currentAddress(db, me, nav.addrId);

  const setDefault = (id: string) => update((d) => { d.addresses.forEach((a) => { if (a.customerId === me.id) a.isDefault = a.id === id; }); });
  const remove = (a: Address) => {
    update((d) => {
      d.addresses = d.addresses.filter((x) => x.id !== a.id);
      if (a.isDefault) { const next = d.addresses.find((x) => x.customerId === me.id); if (next) next.isDefault = true; }
    });
    nav.flash("Address removed");
  };

  return (
    <div className="fade-up" style={{ paddingBottom: 24 }}>
      <PageHeader title={select ? "Select Delivery Address" : "Saved Addresses"} onBack={nav.back} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {mine.length > 0 && (
          <CityMap height={180} fit={mine.map((a) => a.pt)} localities={db.localities.filter((l) => l.cityId === "noida")}
            markers={mine.map((a) => ({ id: a.id, pt: a.pt, kind: a.id === current?.id ? "home" as const : "pin" as const, label: a.label }))} />
        )}
        {mine.map((a) => {
          const vendors = eligibleVendors(db, spotOf(a), [], now).length;
          const on = a.id === current?.id;
          return (
            <div key={a.id} style={{ ...card, padding: 14, border: select && on ? "1.5px solid var(--blue)" : "1.5px solid transparent" }}>
              <button onClick={() => { if (select) { nav.setAddrId(a.id); nav.back(); } }} style={{ all: "unset", cursor: select ? "pointer" : "default", display: "flex", gap: 10, width: "100%" }}>
                <PinIcon s={20} c={on ? "var(--go)" : "var(--ink-mute)"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {a.label} {a.isDefault && <Pill tone="blue">Default</Pill>} {vendors ? <Pill tone="green">Serviceable</Pill> : <Pill tone="red">Not serviceable</Pill>}
                  </p>
                  <p style={small}>{a.line}{a.landmark ? `, ${a.landmark}` : ""} · {db.localities.find((l) => l.id === a.localityId)?.name} {a.pin}</p>
                </div>
              </button>
              <div style={{ display: "flex", gap: 14, marginTop: 10, paddingLeft: 30 }}>
                {!a.isDefault && <button onClick={() => setDefault(a.id)} style={linkBtn}>Set default</button>}
                <button onClick={() => nav.push({ k: "addAddress", editId: a.id })} style={linkBtn}><EditIcon s={13} c="var(--blue)" /> Edit</button>
                {mine.length > 1 && <button onClick={() => remove(a)} style={{ ...linkBtn, color: "var(--error-text)" }}><TrashIcon s={13} c="var(--error-text)" /> Delete</button>}
              </div>
            </div>
          );
        })}
        <button onClick={() => nav.push({ k: "addAddress" })} className="press" style={{ ...card, border: "1.5px dashed var(--line-strong)", boxShadow: "none", padding: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--blue)", fontWeight: 700, fontSize: 14 }}>
          <PlusIcon s={18} c="var(--blue)" /> Add New Address
        </button>
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = { background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--blue)", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 };

export function AddAddressPage({ me, nav, editId, first }: { me: Customer; nav: Nav; editId?: string; first?: boolean }) {
  const db = useData();
  const now = useNow(30000);
  const existing = editId ? db.addresses.find((a) => a.id === editId) : undefined;
  const locs = db.localities.filter((l) => db.cities.find((c) => c.id === l.cityId)?.active);
  const [labelV, setLabelV] = useState<Address["label"]>(existing?.label ?? "Home");
  const [locId, setLocId] = useState(existing?.localityId ?? "l12");
  const [line, setLine] = useState(existing?.line ?? "");
  const [landmark, setLandmark] = useState(existing?.landmark ?? "");
  const loc = locs.find((l) => l.id === locId)!;
  const [pt, setPt] = useState(existing?.pt ?? loc.center);
  const [err, setErr] = useState<string | null>(null);

  const spot = { pt, pin: loc.pin, localityId: loc.id };
  const vendors = eligibleVendors(db, spot, [], now);

  const save = () => {
    if (line.trim().length < 4) { setErr("Enter your house / flat number and street"); return; }
    const id = existing?.id ?? `a${Date.now()}`;
    update((d) => {
      const mine = d.addresses.filter((a) => a.customerId === me.id);
      const rec: Address = { id, customerId: me.id, label: labelV, line: line.trim(), landmark: landmark.trim(), localityId: loc.id, pin: loc.pin, pt, isDefault: existing?.isDefault ?? mine.length === 0 };
      if (existing) d.addresses = d.addresses.map((a) => (a.id === id ? rec : a));
      else d.addresses.push(rec);
    });
    nav.setAddrId(id);
    nav.flash(existing ? "Address updated" : "Address saved");
    nav.back();
  };

  return (
    <div className="fade-up">
      <PageHeader title={first ? "Where should we deliver?" : existing ? "Edit Address" : "Add New Address"} onBack={first ? undefined : nav.back} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <CityMap height={220} fit={[pt]} localities={locs} onPick={setPt} markers={[
            { id: "pin", pt, kind: "pin" },
            ...vendors.map((v) => ({ id: v.id, pt: v.location, kind: "vendor" as const })),
          ]} />
          <span style={{ position: "absolute", left: 10, bottom: 10, background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "5px 9px", fontSize: 11.5, fontWeight: 600 }}>Tap the map to move the pin</span>
        </div>
        <div role="status" style={{ ...card, padding: 12, boxShadow: "none", background: vendors.length ? "var(--success)" : "var(--error)", color: vendors.length ? "var(--success-text)" : "var(--error-text)", fontSize: 13, fontWeight: 600 }}>
          {vendors.length ? `✓ Serviceable — ${vendors.length} partner${vendors.length > 1 ? "s" : ""} deliver here` : "✕ We don't deliver to this spot yet. You can still save it."}
        </div>
        <div>
          <p style={label}>Save as</p>
          <div style={{ display: "flex", gap: 8 }}>{(["Home", "Office", "Other"] as const).map((l) => <Chip key={l} on={labelV === l} onClick={() => setLabelV(l)}>{l}</Chip>)}</div>
        </div>
        <div>
          <label style={label} htmlFor="a-loc">Area / locality</label>
          <select id="a-loc" value={locId} onChange={(e) => { setLocId(e.target.value); setPt(locs.find((l) => l.id === e.target.value)!.center); }} style={field}>
            {locs.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.pin}</option>)}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="a-line">House / flat, street</label>
          <input id="a-line" value={line} onChange={(e) => { setLine(e.target.value); setErr(null); }} placeholder="e.g. B-45, Sector 12" style={field} />
        </div>
        <div>
          <label style={label} htmlFor="a-lm">Landmark (optional)</label>
          <input id="a-lm" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Near Shiv Mandir" style={field} />
        </div>
        {err && <p role="alert" style={{ margin: 0, color: "var(--error-text)", fontSize: 12.5, fontWeight: 600 }}>{err}</p>}
      </div>
      <Footer><PrimaryButton onClick={save}>Confirm Address</PrimaryButton></Footer>
    </div>
  );
}
