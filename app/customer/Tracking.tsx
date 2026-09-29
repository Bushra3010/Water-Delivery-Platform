"use client";

import { useState } from "react";
import AdSlot from "../components/AdSlot";
import CityMap from "../components/CityMap";
import ProductArt from "../components/ProductArt";
import { CheckIcon, PhoneIcon, ReceiptIcon, WhatsAppIcon } from "../components/icons";
import { Avatar, BottomSheet, Chip, Empty, GhostButton, Line, PageHeader, Pill, PrimaryButton, StarPicker, Stars, StatusBadge, Tabs, card, field, label, small } from "../components/ui";
import { cancelOrder, rateOrder, retryDispatch } from "../lib/actions";
import { DONE, LIVE, approx, cancelPolicy, driverPos, etaMins, fmtDT, fmtDate, fmtTime, initials, inr, isOpen, maskPhone, rankDrivers, route } from "../lib/logic";
import { update, useData, useNow } from "../lib/store";
import type { Customer, DB, Order } from "../lib/types";
import type { Nav } from "./CustomerApp";
import { statusLine } from "./Home";

export function driverRating(db: DB, driverId: string) {
  const r = db.orders.filter((o) => o.driverId === driverId && o.rating).map((o) => o.rating!.driver);
  return r.length ? r.reduce((s, x) => s + x, 0) / r.length : 5;
}

const STEPS: { label: string; of: Order["status"][] }[] = [
  { label: "Order Confirmed", of: ["Placed", "Searching", "Assigned"] },
  { label: "Driver Assigned", of: ["Accepted", "Pickup"] },
  { label: "Out for Delivery", of: ["Out for Delivery"] },
  { label: "Arrived", of: ["Arrived"] },
  { label: "Delivered", of: ["Delivered", "Payment Confirmed", "Completed"] },
];

export function TrackPage({ id, me, nav }: { id: string; me: Customer; nav: Nav }) {
  const db = useData();
  const now = useNow(1000);
  const [cancelling, setCancelling] = useState(false);
  const o = db.orders.find((x) => x.id === id);
  if (!o) return <div><PageHeader title="Order" onBack={nav.back} /><div style={{ padding: 16 }}><Empty title="Order not found" /></div></div>;

  const driver = db.drivers.find((d) => d.id === o.driverId);
  const vehicle = db.vehicles.find((v) => v.id === driver?.vehicleId);
  const vendor = db.vendors.find((v) => v.id === o.vendorId);
  const live = LIVE.includes(o.status);
  const finding = o.status === "Searching" || o.status === "Assigned";
  const done = DONE.includes(o.status);
  const pos = live ? driverPos(o, driver, now) : null;
  const eta = etaMins(o, now);
  const policy = cancelPolicy(db.settings, o);
  const curStep = STEPS.findIndex((s) => s.of.includes(o.status));

  return (
    <div className="fade-up" style={{ paddingBottom: 28 }}>
      <PageHeader title={live ? "Live Tracking" : done ? "Order Details" : `Order #${o.id}`} onBack={nav.back} right={<StatusBadge status={o.status} customer />} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {finding && <Finding o={o} db={db} now={now} />}

        {o.status === "Placed" && o.slot && (
          <div style={{ ...card, padding: 16, textAlign: "center" }}>
            <p style={{ fontSize: 34, margin: 0 }}>🗓️</p>
            <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 800 }}>Scheduled for {fmtDate(o.slot.date)}</p>
            <p style={small}>{o.slot.window} · we&apos;ll start finding a driver 30 minutes before your slot.</p>
          </div>
        )}

        {o.status === "Failed Assignment" && (
          <div role="alert" style={{ ...card, padding: 16, background: "var(--error)", boxShadow: "none" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--error-text)" }}>No driver could take this order</p>
            <p style={{ ...small, color: "var(--error-text)" }}>
              {o.attempts.slice(o.roundStart ?? 0).length} nearby driver(s) were asked. {o.payment.status === "Refund Pending" ? "Your payment will be refunded by our team." : ""}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <PrimaryButton onClick={() => update((d) => { const x = d.orders.find((y) => y.id === o.id)!; retryDispatch(d, x, me.name, "Customer", Date.now()); })} style={{ padding: 11, fontSize: 14 }}>Try again</PrimaryButton>
            </div>
          </div>
        )}

        {live && (
          <>
            <div style={{ position: "relative" }}>
              <CityMap height={250} fit={[o.address.pt, ...(pos ? [pos] : [])]} localities={db.localities.filter((l) => l.cityId === "noida")} showLabels={false}
                route={pos && o.status !== "Arrived" ? route(pos, o.address.pt) : undefined}
                markers={[{ id: "home", pt: o.address.pt, kind: "home", label: "You" }, ...(pos ? [{ id: "drv", pt: pos, kind: "driver" as const }] : [])]} />
              <div style={{ position: "absolute", left: 10, right: 10, top: 10, background: "rgba(255,255,255,0.95)", borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-md)" }}>
                <span className="animate-pulse-dot" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--go)" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--go-dark)" }}>{statusLine(o.status)}</p>
                  {eta && o.status !== "Arrived" && <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>Arriving in {eta} min</p>}
                </div>
              </div>
            </div>
            {driver && (
              <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar initials={initials(driver.name)} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{driver.name}</p>
                  <p style={{ ...small, margin: 0 }}>{vehicle ? `${vehicle.number} · ${vehicle.type}` : "Delivery partner"} · ★ {driverRating(db, driver.id).toFixed(1)}</p>
                  <p style={{ ...small, margin: 0, fontSize: 11 }}>{vendor?.name}</p>
                </div>
                <a href={`tel:${driver.phone}`} aria-label={`Call ${driver.name} (${maskPhone(driver.phone)})`} style={{ width: 42, height: 42, borderRadius: 12, background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}><PhoneIcon s={19} c="var(--go)" /></a>
              </div>
            )}
          </>
        )}

        {/* OTP */}
        {(live || finding) && (
          <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--gold-tint)", boxShadow: "none", border: "1px solid var(--gold-100)" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Delivery OTP</p>
              <p style={{ ...small, margin: 0 }}>Share with the driver only when you receive your water.</p>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.2em", color: "var(--blue-dark)" }}>{o.otp}</span>
          </div>
        )}

        {/* Steps */}
        {o.status !== "Cancelled" && o.status !== "Failed Assignment" && (
          <div style={{ ...card, padding: "12px 14px" }}>
            {STEPS.map((s, i) => {
              const at = [...o.timeline].reverse().find((t) => s.of.includes(t.status))?.at;
              const reached = i <= curStep;
              return (
                <div key={s.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: reached ? "var(--go)" : "var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>{reached && <CheckIcon s={12} c="white" />}</span>
                    {i < STEPS.length - 1 && <span style={{ width: 2, height: 22, background: i < curStep ? "var(--go)" : "var(--line)" }} />}
                  </div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: reached ? 600 : 500, color: reached ? "var(--ink)" : "var(--ink-mute)" }}>
                    <span>{s.label}</span><span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{reached && at ? fmtTime(at) : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {done && <Delivered o={o} db={db} nav={nav} />}

        {o.status === "Cancelled" && o.cancel && (
          <div style={{ ...card, padding: 14 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Cancelled by {o.cancel.by}</p>
            <p style={small}>{o.cancel.reason}{o.cancel.fee ? ` · cancellation fee ${inr(o.cancel.fee)}` : ""}</p>
            {o.payment.status === "Refund Pending" && <p style={{ ...small, color: "var(--warning-text)", fontWeight: 600 }}>Refund of {inr(o.total - o.cancel.fee)} is being processed by our team.</p>}
            {o.payment.status === "Refunded" && <p style={{ ...small, color: "var(--success-text)", fontWeight: 600 }}>Refunded.</p>}
          </div>
        )}

        {/* Summary */}
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>#{o.id}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>{fmtDT(o.createdAt)}</p>
          </div>
          {o.items.map((i) => (
            <div key={i.skuId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
              <ProductArt art={db.skus.find((s) => s.id === i.skuId)?.art ?? "can20"} size={34} />
              <span style={{ flex: 1, fontSize: 13.5 }}>{i.qty} × {i.name}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{o.payment.method === "Subscription" ? "Plan" : inr(i.price * i.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "8px 0" }} />
          {o.discount > 0 && <Line k={`Coupon ${o.coupon}`} v={`− ${inr(o.discount)}`} tone="var(--success-text)" />}
          {o.tax > 0 && <Line k="GST" v={inr(o.tax)} />}
          {o.deliveryFee > 0 && <Line k="Delivery fee" v={inr(o.deliveryFee)} />}
          {o.deposit > 0 && <Line k="Can deposit" v={inr(o.deposit)} />}
          <Line k={`Total · ${o.payment.method}`} v={inr(o.total)} strong />
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Pill tone={o.payment.status === "Paid" || o.payment.status === "Collected" || o.payment.status === "Covered" || o.payment.status === "Refunded" ? "green" : o.payment.status === "Refund Pending" ? "amber" : "grey"}>Payment: {o.payment.status}</Pill>
            {o.cans.expected > 0 && <Pill tone="blue">Return {o.cans.returned ?? o.cans.expected} empty can{o.cans.expected > 1 ? "s" : ""}</Pill>}
            <Pill tone="purple">{o.type}{o.slot ? ` · ${o.slot.window}` : ""}</Pill>
          </div>
          {o.cans.note && <p style={{ ...small, fontSize: 11.5 }}>{o.cans.note}</p>}
          <p style={{ ...small, fontSize: 11.5 }}>{o.address.label} · {o.address.line}</p>
        </div>

        {isOpen(o) && (
          <GhostButton danger onClick={() => setCancelling(true)}>{policy.allowed ? "Cancel order" : "Need help with this order?"}</GhostButton>
        )}
        {(isOpen(o) || o.status === "Failed Assignment") && (
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`tel:${db.settings.support.phone}`} style={supportBtn}><PhoneIcon s={16} c="var(--blue)" /> Call support</a>
            <a href={`https://wa.me/${db.settings.support.whatsapp}?text=${encodeURIComponent(`Help with order ${o.id}`)}`} target="_blank" rel="noreferrer" style={supportBtn}><WhatsAppIcon s={16} c="var(--go)" /> WhatsApp</a>
          </div>
        )}
      </div>

      {cancelling && <CancelSheet o={o} me={me} onClose={() => setCancelling(false)} onDone={() => { setCancelling(false); nav.flash("Order cancelled"); }} />}
    </div>
  );
}

const supportBtn: React.CSSProperties = { flex: 1, ...card, padding: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink)", textDecoration: "none" };

function Finding({ o, db, now }: { o: Order; db: DB; now: number }) {
  const round = o.attempts.slice(o.roundStart ?? 0);
  const others = rankDrivers(db, { pt: o.address.pt, pin: o.address.pin, localityId: o.address.localityId }, o.items.map((i) => i.skuId), now);
  const offered = o.offer ? db.drivers.find((d) => d.id === o.offer!.driverId) : undefined;
  const left = o.offer ? Math.max(0, Math.ceil((o.offer.until - now) / 1000)) : 0;
  return (
    <>
      <div style={{ position: "relative" }}>
        <CityMap height={230} fit={[o.address.pt]} radarAt={o.address.pt} showLabels={false}
          markers={[{ id: "home", pt: o.address.pt, kind: "home" }, ...others.slice(0, 6).map((c, i) => ({ id: c.driver.id, pt: approx(c.driver.loc, i + 3), kind: "approx" as const }))]} />
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, background: "rgba(255,255,255,0.95)", borderRadius: 14, padding: "10px 12px", boxShadow: "var(--shadow-md)" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Finding the nearest driver…</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{offered ? `Request sent to ${offered.name.split(" ")[0]} · waiting ${left}s` : "Checking partners near you"}</p>
        </div>
      </div>
      <div style={{ ...card, padding: "10px 14px" }}>
        <p style={{ ...label, fontSize: 12.5, marginBottom: 4 }}>Dispatch progress</p>
        {round.map((a, i) => {
          const d = db.drivers.find((x) => x.id === a.driverId);
          const tone = a.result === "Offered" ? "purple" : a.result === "Accepted" || a.result === "Manual" ? "green" : "grey";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5 }}>
              <span style={{ width: 18, textAlign: "center", color: "var(--ink-mute)", fontWeight: 700 }}>{i + 1}</span>
              <span style={{ flex: 1 }}>{d?.name.split(" ")[0]} · {a.distKm} km</span>
              <Pill tone={tone}>{a.result === "Offered" ? `Waiting ${left}s` : a.result === "Timeout" ? "No response" : a.result === "Rejected" ? "Declined" : a.result}</Pill>
            </div>
          );
        })}
        {!round.length && <p style={small}>Starting search…</p>}
      </div>
      {o.offer?.driverId === "d1" && (
        <p style={{ margin: 0, padding: "10px 12px", borderRadius: 12, background: "var(--gold-tint)", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          <b>Demo:</b> Amit Kumar is driven by a person. Open <a href="/driver" target="_blank" style={{ color: "var(--blue)", fontWeight: 700 }}>/driver</a> in another tab to accept — or wait {db.settings.dispatchTimeoutSec}s and the request cascades to the next nearest driver.
        </p>
      )}
    </>
  );
}

const TAGS = ["On time", "Polite driver", "Clean can", "Sealed cap", "Good taste", "Late delivery", "Can was dirty"];

function Delivered({ o, db, nav }: { o: Order; db: DB; nav: Nav }) {
  const [drv, setDrv] = useState(5);
  const [ven, setVen] = useState(5);
  const [prod, setProd] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [ad, setAd] = useState(false);
  const driver = db.drivers.find((d) => d.id === o.driverId);
  const vendor = db.vendors.find((v) => v.id === o.vendorId);

  const submit = () => {
    rateOrder(o.id, { driver: drv, vendor: ven, product: prod, tags, comment: comment.trim() });
    nav.flash("Thanks for your feedback!");
    if (db.settings.ads.enabled && db.settings.ads.interstitial) setAd(true);
  };

  return (
    <>
      <div style={{ ...card, padding: 18, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--go)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckIcon s={30} c="white" /></div>
        <p style={{ margin: "10px 0 0", fontSize: 18, fontWeight: 800, color: "var(--go-dark)" }}>Delivered Successfully!</p>
        <p style={small}>{fmtDT(o.timeline.find((t) => t.status === "Delivered")?.at ?? o.createdAt)} · by {driver?.name ?? "our partner"} ({vendor?.name})</p>
        {o.proofPhoto && <p style={{ ...small, fontSize: 11.5 }}>📷 Delivery photo captured</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {o.invoiceNo && <GhostButton onClick={() => nav.push({ k: "invoice", id: o.id })} style={{ padding: 10, fontSize: 13 }}><ReceiptIcon s={16} c="var(--ink)" /> {vendor?.gstin ? "Invoice" : "Receipt"}</GhostButton>}
          <GhostButton onClick={() => nav.push({ k: "order", skuId: o.items[0].skuId })} style={{ padding: 10, fontSize: 13 }}>Reorder</GhostButton>
        </div>
      </div>

      {o.rating ? (
        <div style={{ ...card, padding: 14 }}>
          <p style={{ ...label, marginBottom: 6 }}>Your rating</p>
          <Line k="Driver" v={<Stars value={o.rating.driver} />} />
          <Line k="Vendor" v={<Stars value={o.rating.vendor} />} />
          <Line k="Water quality" v={<Stars value={o.rating.product} />} />
          {o.rating.comment && <p style={small}>“{o.rating.comment}”</p>}
        </div>
      ) : o.driverId ? (
        <div style={{ ...card, padding: 16 }}>
          <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, textAlign: "center" }}>How was your delivery?</p>
          {[["Driver", drv, setDrv], ["Vendor", ven, setVen], ["Water quality", prod, setProd]].map(([n, v, set]) => (
            <div key={n as string} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{n as string}</span>
              <StarPicker value={v as number} onChange={set as (n: number) => void} size={26} name={n as string} />
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
            {TAGS.map((t) => <Chip key={t} on={tags.includes(t)} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</Chip>)}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything else? (optional)" aria-label="Comment" rows={2} style={{ ...field, resize: "none" }} />
          <PrimaryButton onClick={submit} style={{ marginTop: 12 }}>Submit</PrimaryButton>
        </div>
      ) : null}

      {ad && (
        <div role="dialog" aria-label="Advertisement" style={{ position: "absolute", inset: 0, zIndex: 180, background: "rgba(15,23,41,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ ...card, padding: 22, textAlign: "center", width: "100%" }}>
            <Pill tone="amber">Ad</Pill>
            <p style={{ margin: "12px 0 4px", fontWeight: 700 }}>Interstitial ad · Google AdMob</p>
            <p style={small}>{db.settings.ads.unitId}</p>
            <PrimaryButton onClick={() => setAd(false)} style={{ marginTop: 14 }}>Close</PrimaryButton>
          </div>
        </div>
      )}
    </>
  );
}

const REASONS = ["Ordered by mistake", "Delivery taking too long", "Want to change address / items", "Found another supplier", "Other"];

function CancelSheet({ o, me, onClose, onDone }: { o: Order; me: Customer; onClose: () => void; onDone: () => void }) {
  const db = useData();
  const [reason, setReason] = useState(REASONS[0]);
  const [err, setErr] = useState<string | null>(null);
  const p = cancelPolicy(db.settings, o);
  const go = () => {
    let msg = null as string | null;
    update((d) => { const x = d.orders.find((y) => y.id === o.id)!; msg = cancelOrder(d, x, "Customer", reason, Date.now()); if (msg) return false; });
    if (msg) setErr(msg); else onDone();
  };
  return (
    <BottomSheet title={p.allowed ? "Cancel order?" : "Need help?"} onClose={onClose}>
      <p style={{ ...small, margin: "0 0 12px" }}>{p.note}</p>
      {p.allowed ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {REASONS.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
          </div>
          {err && <p role="alert" style={{ color: "var(--error-text)", fontSize: 12.5, fontWeight: 600 }}>{err}</p>}
          <PrimaryButton onClick={go} style={{ marginTop: 14, background: "var(--red)", boxShadow: "none" }}>Cancel order{p.fee ? ` (${inr(p.fee)} fee)` : ""}</PrimaryButton>
        </>
      ) : (
        <a href={`tel:${db.settings.support.phone}`} style={{ ...supportBtn, padding: 14 }}><PhoneIcon s={16} c="var(--blue)" /> Call support · {me.name.split(" ")[0]}, we&apos;re here to help</a>
      )}
    </BottomSheet>
  );
}

/* ───────────────────────── Invoice ───────────────────────── */

export function InvoicePage({ id, nav }: { id: string; nav: Nav }) {
  const db = useData();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  const v = db.vendors.find((x) => x.id === o.vendorId);
  const c = db.customers.find((x) => x.id === o.customerId);
  const taxable = o.subtotal - o.discount;
  const gst = !!v?.gstin;
  return (
    <div className="fade-up" style={{ paddingBottom: 24 }}>
      <PageHeader title={gst ? "Tax Invoice" : "Payment Receipt"} onBack={nav.back} right={<button onClick={() => window.print()} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 700, cursor: "pointer" }}>Print</button>} />
      <div style={{ margin: "0 16px", ...card, padding: 18, fontSize: 12.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{v?.name}</p>
            <p style={{ ...small, margin: 0, fontSize: 11.5 }}>{v?.address}</p>
            {gst && <p style={{ ...small, margin: 0, fontSize: 11.5 }}>GSTIN {v!.gstin}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{o.invoiceNo}</p>
            <p style={{ ...small, margin: 0, fontSize: 11.5 }}>{fmtDate(o.timeline.find((t) => t.status === "Completed")?.at ?? o.createdAt)}</p>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", margin: "12px 0", paddingTop: 10 }}>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 700 }}>BILL TO</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{c?.name}</p>
          <p style={{ ...small, margin: 0, fontSize: 11.5 }}>{o.address.line}, {o.address.pin}</p>
        </div>
        {o.items.map((i) => <Line key={i.skuId} k={`${i.name} × ${i.qty} @ ${inr(i.price)}`} v={inr(i.price * i.qty)} />)}
        {o.discount > 0 && <Line k={`Discount (${o.coupon})`} v={`− ${inr(o.discount)}`} />}
        {gst && <>
          <Line k="Taxable value" v={inr(taxable)} />
          <Line k={`CGST @ ${v!.gstRate / 2}%`} v={inr(o.tax / 2)} />
          <Line k={`SGST @ ${v!.gstRate / 2}%`} v={inr(o.tax / 2)} />
        </>}
        {o.deliveryFee > 0 && <Line k="Delivery fee" v={inr(o.deliveryFee)} />}
        {o.deposit > 0 && <Line k="Refundable can deposit" v={inr(o.deposit)} />}
        <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "8px 0" }} />
        <Line k="Total" v={inr(o.total)} strong />
        <p style={{ ...small, fontSize: 11.5 }}>Paid via {o.payment.method}{o.payment.ref ? ` · Ref ${o.payment.ref}` : ""} · collected by {o.payment.routing === "direct" ? "vendor" : "platform"}</p>
        {!gst && <p style={{ ...small, fontSize: 11 }}>Vendor is not GST-registered — this is a payment receipt, not a tax invoice.</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── Orders tab ───────────────────────── */

export function OrdersTab({ me, nav }: { me: Customer; nav: Nav }) {
  const db = useData();
  const [tab, setTab] = useState<"active" | "past">("active");
  const mine = db.orders.filter((o) => o.customerId === me.id);
  const list = mine.filter((o) => (tab === "active" ? isOpen(o) : !isOpen(o)));
  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      <h2 style={{ margin: "18px 2px 12px", fontSize: 20, fontWeight: 800 }}>My Orders</h2>
      <Tabs tabs={[{ id: "active", label: `Active (${mine.filter(isOpen).length})` }, { id: "past", label: "Past" }]} value={tab} onChange={setTab} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {list.map((o, i) => (
          <div key={o.id}>
            <button onClick={() => nav.push({ k: "track", id: o.id })} className="press" style={{ ...card, width: "100%", border: "none", cursor: "pointer", textAlign: "left", padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ProductArt art={db.skus.find((s) => s.id === o.items[0].skuId)?.art ?? "can20"} size={40} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{o.items.map((x) => `${x.qty} × ${x.name}`).join(", ")}</p>
                <p style={{ ...small, margin: 0, fontSize: 11.5 }}>#{o.id} · {o.slot ? `${fmtDate(o.slot.date)}, ${o.slot.window}` : fmtDT(o.createdAt)}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700 }}>{o.payment.method === "Subscription" ? "Subscription" : inr(o.total)}</p>
              </div>
              <StatusBadge status={o.status} customer />
            </button>
            {i === 2 && <AdSlot placement="ordersNative" />}
          </div>
        ))}
        {!list.length && <Empty title={tab === "active" ? "No active orders" : "No past orders yet"} body="Fresh water is a tap away." action={<PrimaryButton tone="go" onClick={() => nav.push({ k: "order" })}>Order water</PrimaryButton>} />}
      </div>
    </div>
  );
}
