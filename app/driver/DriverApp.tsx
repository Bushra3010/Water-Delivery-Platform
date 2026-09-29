"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND, BrandMark } from "../components/Brand";
import CityMap from "../components/CityMap";
import ProductArt from "../components/ProductArt";
import { CameraIcon, CanIcon, CheckIcon, NavigateIcon, PhoneIcon, PinIcon } from "../components/icons";
import { Avatar, Empty, Footer, GhostButton, Line, PageHeader, PhoneShell, Pill, PillNav, PrimaryButton, StatusBadge, Stepper, Tabs, Toast, Toggle, card, field, label, small } from "../components/ui";
import { DemoLinks } from "../customer/Account";
import { acceptOffer, advance, completeDelivery, rejectOffer, useDispatchEngine } from "../lib/actions";
import { DAY, DONE, LIVE, distKm, driverPos, fmtDT, fmtDate, fmtTime, initials, inr, maskPhone, route, startOfDay } from "../lib/logic";
import { session, update, useDB, useData, useNow } from "../lib/store";
import type { DB, Driver, Order } from "../lib/types";

type Tab = "jobs" | "history" | "earnings" | "profile";

/** Demo payout rule shown to drivers (vendor-configurable later). */
export const payout = (o: Order) => 20 + Math.max(0, o.items.reduce((s, i) => s + i.qty, 0) - 1) * 5;

export default function DriverApp() {
  const db = useDB();
  useDispatchEngine();
  const [meId, setMeId] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("jobs");
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setMeId(session.get("driver")); }, []);

  if (!db || meId === undefined) return <PhoneShell><div /></PhoneShell>;
  const me = meId ? db.drivers.find((d) => d.id === meId) : undefined;
  const flash = (m: string) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 2000); };

  if (!me) return <PhoneShell><DriverLogin onDone={(id) => { session.set("driver", id); setMeId(id); }} /></PhoneShell>;
  const logout = () => { session.set("driver", null); setMeId(null); setOpen(null); setTab("jobs"); };

  const active = db.orders.find((o) => o.driverId === me.id && LIVE.includes(o.status));
  const offer = db.orders.find((o) => o.status === "Assigned" && o.offer?.driverId === me.id);
  const job = open ? db.orders.find((o) => o.id === open) : undefined;
  const showNav = !job;

  return (
    <PhoneShell>
      <div className="no-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: showNav ? "calc(80px + env(safe-area-inset-bottom))" : undefined }}>
        {job ? <JobPage key={job.id} o={job} me={me} onBack={() => setOpen(null)} flash={flash} /> : (
          <>
            {tab === "jobs" && <JobsTab me={me} active={active} onOpen={setOpen} flash={flash} />}
            {tab === "history" && <HistoryTab me={me} onOpen={setOpen} />}
            {tab === "earnings" && <EarningsTab me={me} />}
            {tab === "profile" && <DriverProfile me={me} onLogout={logout} />}
          </>
        )}
      </div>
      {showNav && (
        <PillNav active={tab} onChange={setTab} tabs={[
          { id: "jobs", label: "Deliveries", icon: (c) => <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7z" /><circle cx="6.5" cy="17.5" r="2" /><circle cx="17" cy="17.5" r="2" /></svg>, dot: !!offer },
          { id: "history", label: "History", icon: (c) => <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg> },
          { id: "earnings", label: "Earnings", icon: (c) => <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><rect x="3" y="6" width="18" height="13" rx="2.5" /><circle cx="12" cy="12.5" r="2.6" stroke="white" strokeWidth="1.7" fill="none" /></svg> },
          { id: "profile", label: "Profile", icon: (c) => <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><circle cx="12" cy="7.8" r="4.3" /><path d="M3.8 20.2a8.2 8.2 0 0 1 16.4 0 1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1z" /></svg> },
        ]} />
      )}
      {offer && me.online && <RequestModal o={offer} me={me} onAccepted={() => { setOpen(offer.id); flash("Order accepted"); }} />}
      <Toast msg={toast} bottom={showNav ? 92 : 100} />
    </PhoneShell>
  );
}

/* ───────────────────────── Login ───────────────────────── */

function DriverLogin({ onDone }: { onDone: (id: string) => void }) {
  const db = useData();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = () => {
    const d = db.drivers.find((x) => x.phone === phone);
    if (!d) { setErr("This number isn't registered. Ask your vendor to add you."); return; }
    if (d.status === "Pending" || d.kyc !== "Verified") { setErr("Your account is awaiting verification."); return; }
    if (d.status !== "Active") { setErr(`Your account is ${d.status.toLowerCase()}. Contact your vendor.`); return; }
    setErr(null); setSent(true);
  };
  const verify = () => { if (code !== "1234") { setErr("Incorrect OTP"); return; } onDone(db.drivers.find((x) => x.phone === phone)!.id); };
  const demo = db.drivers.filter((d) => ["d1", "d2", "d5", "d4"].includes(d.id));

  return (
    <div className="fade-up" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 20px", overflowY: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 24 }}>
        <div style={{ alignSelf: "center", width: 150, height: 150, borderRadius: "50%", background: "linear-gradient(160deg,#dbeafe,#bfdbfe)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <ProductArt art="can20" size={100} />
          <div style={{ position: "absolute", top: 6, right: 6 }}><BrandMark size={38} /></div>
        </div>
        <h1 style={{ margin: "18px 0 0", fontSize: 26, fontWeight: 800, textAlign: "center", color: "var(--blue-dark)" }}>{BRAND.name}</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", textAlign: "center" }}>{BRAND.driverTagline} · Driver app</p>
        <div style={{ marginTop: 24 }}>
          <label style={label} htmlFor="d-phone">Registered mobile number</label>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...field, width: "auto", display: "flex", alignItems: "center", color: "var(--ink-soft)" }}>+91</span>
            <input id="d-phone" inputMode="numeric" value={phone} disabled={sent} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setErr(null); }} style={{ ...field, flex: 1 }} />
          </div>
          {sent && (
            <div className="fade-up" style={{ marginTop: 14 }}>
              <label style={label} htmlFor="d-otp">OTP</label>
              <input id="d-otp" inputMode="numeric" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(null); }} style={{ ...field, fontSize: 22, fontWeight: 800, letterSpacing: "0.5em", textAlign: "center" }} />
              <p style={{ margin: "6px 2px 0", fontSize: 11.5, color: "var(--ink-mute)" }}>Demo OTP: 1234</p>
            </div>
          )}
          {err && <p role="alert" style={{ margin: "8px 2px 0", fontSize: 12.5, color: "var(--error-text)", fontWeight: 600 }}>{err}</p>}
          {!sent && (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "var(--gold-tint)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              Demo drivers:{" "}
              {demo.map((d) => (
                <button key={d.id} onClick={() => { setPhone(d.phone); setErr(null); }} style={{ background: "none", border: "none", padding: "0 4px", color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                  {d.name.split(" ")[0]}{d.status !== "Active" ? " (pending)" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "16px 0 calc(24px + env(safe-area-inset-bottom))" }}>
        {sent ? <PrimaryButton disabled={code.length !== 4} onClick={verify}>Login</PrimaryButton> : <PrimaryButton disabled={phone.length !== 10} onClick={send}>Send OTP</PrimaryButton>}
      </div>
    </div>
  );
}

/* ───────────────────────── Incoming request ───────────────────────── */

function RequestModal({ o, me, onAccepted }: { o: Order; me: Driver; onAccepted: () => void }) {
  const db = useData();
  const now = useNow(250);
  const total = db.settings.dispatchTimeoutSec * 1000;
  const leftMs = Math.max(0, (o.offer?.until ?? now) - now);
  const km = distKm(me.loc, o.address.pt);
  const qty = o.items.reduce((s, i) => s + i.qty, 0);
  const accept = () => {
    let ok = false;
    update((d) => { const x = d.orders.find((y) => y.id === o.id)!; ok = acceptOffer(d, x, me.id, Date.now()); if (!ok) return false; });
    if (ok) onAccepted();
  };
  const reject = () => update((d) => { const x = d.orders.find((y) => y.id === o.id)!; rejectOffer(d, x, me.id, Date.now()); });
  const r = 26, c = 2 * Math.PI * r;

  return (
    <div role="dialog" aria-label="New delivery request" style={{ position: "absolute", inset: 0, zIndex: 160, background: "rgba(15,23,41,0.55)", display: "flex", alignItems: "flex-end" }}>
      <div className="sheet-up" style={{ width: "100%", background: "var(--app-bg)", borderRadius: "24px 24px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Pill tone="purple">New delivery request</Pill>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800 }}>{qty} × {o.items[0].name}{o.items.length > 1 ? ` +${o.items.length - 1}` : ""}</p>
            <p style={{ ...small, margin: 0 }}>{km.toFixed(1)} km away · earn {inr(payout(o))}</p>
          </div>
          <svg width="64" height="64" viewBox="0 0 64 64" aria-label={`${Math.ceil(leftMs / 1000)} seconds left`}>
            <circle cx="32" cy="32" r={r} stroke="var(--line)" strokeWidth="6" fill="none" />
            <circle cx="32" cy="32" r={r} stroke="var(--go)" strokeWidth="6" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - leftMs / total)} transform="rotate(-90 32 32)" strokeLinecap="round" />
            <text x="32" y="38" textAnchor="middle" fontSize="17" fontWeight="800" fill="var(--ink)">{Math.ceil(leftMs / 1000)}</text>
          </svg>
        </div>
        <div style={{ marginTop: 12 }}>
          <CityMap height={150} fit={[me.loc, o.address.pt]} route={route(me.loc, o.address.pt)} showLabels={false}
            markers={[{ id: "me", pt: me.loc, kind: "driver" }, { id: "dst", pt: o.address.pt, kind: "home" }]} />
        </div>
        <div style={{ ...card, padding: 12, marginTop: 10, display: "flex", gap: 10 }}>
          <PinIcon s={18} c="var(--go)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{db.localities.find((l) => l.id === o.address.localityId)?.name} · {o.address.pin}</p>
            <p style={{ ...small, margin: 0, fontSize: 11.5 }}>{o.payment.method === "COD" ? `Collect ${inr(o.total)} cash` : o.payment.method === "Subscription" ? "Subscription — no payment" : "Prepaid online"} · {o.cans.expected} empty can(s) to collect</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <GhostButton danger onClick={reject} style={{ flex: 1 }}>Reject</GhostButton>
          <PrimaryButton tone="go" onClick={accept} style={{ flex: 2 }}>Accept</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Jobs tab ───────────────────────── */

function JobsTab({ me, active, onOpen, flash }: { me: Driver; active?: Order; onOpen: (id: string) => void; flash: (m: string) => void }) {
  const db = useData();
  const vendor = db.vendors.find((v) => v.id === me.vendorId)!;
  const t0 = startOfDay(Date.now());
  const today = db.orders.filter((o) => o.driverId === me.id && DONE.includes(o.status) && o.createdAt >= t0);
  const cash = today.filter((o) => o.payment.method === "COD").reduce((s, o) => s + o.total, 0);
  const earned = today.reduce((s, o) => s + payout(o), 0);
  const upcoming = db.orders.filter((o) => o.status === "Placed" && o.slot && (o.vendorId === me.vendorId || !o.vendorId) && o.slot.date < Date.now() + 2 * DAY).slice(0, 3);
  const setOnline = (v: boolean) => {
    if (!v && active) { flash("Finish your current delivery first"); return; }
    update((d) => { d.drivers.find((x) => x.id === me.id)!.online = v; });
    flash(v ? "You're online — requests will come in" : "You're offline");
  };

  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 0 14px" }}>
        <Avatar initials={initials(me.name)} size={46} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Hi, {me.name.split(" ")[0]}</p>
          <p style={{ ...small, margin: 0 }}>{vendor.name}</p>
        </div>
      </div>

      <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12, background: me.online ? "var(--success)" : "var(--surface-dim)", boxShadow: "none" }}>
        <span className={me.online ? "animate-pulse-dot" : ""} style={{ width: 11, height: 11, borderRadius: "50%", background: me.online ? "var(--go)" : "var(--ink-mute)" }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: me.online ? "var(--go-dark)" : "var(--ink-soft)" }}>{me.online ? "You're online" : "You're offline"}</p>
          <p style={{ ...small, margin: 0, fontSize: 11.5 }}>{me.online ? "Nearest-first requests come to you automatically" : "Go online to receive delivery requests"}</p>
        </div>
        <Toggle on={me.online} onChange={setOnline} label="Online" tone="go" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 12 }}>
        {[["Deliveries", String(today.length)], ["Earning", inr(earned)], ["Cash in hand", inr(cash)]].map(([k, v]) => (
          <div key={k} style={{ ...card, padding: "12px 8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{v}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)" }}>{k}</p>
          </div>
        ))}
      </div>

      <h3 style={{ margin: "20px 2px 10px", fontSize: 15.5, fontWeight: 700 }}>Current delivery</h3>
      {active ? (
        <button onClick={() => onOpen(active.id)} className="press" style={{ ...card, width: "100%", border: "none", cursor: "pointer", textAlign: "left", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>#{active.id}</p>
            <StatusBadge status={active.status} />
          </div>
          <p style={{ ...small }}>{active.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>
          <p style={{ ...small, margin: 0 }}>{active.address.line} · {distKm(me.loc, active.address.pt).toFixed(1)} km</p>
          <PrimaryButton style={{ marginTop: 10, padding: 11, fontSize: 14 }}>Continue delivery →</PrimaryButton>
        </button>
      ) : (
        <Empty title={me.online ? "Waiting for requests…" : "No active delivery"} body={me.online ? "Keep the app open. New requests pop up here with a countdown." : undefined} />
      )}

      {upcoming.length > 0 && (
        <>
          <h3 style={{ margin: "20px 2px 10px", fontSize: 15.5, fontWeight: 700 }}>Scheduled soon (area)</h3>
          <div style={{ ...card, padding: "4px 14px" }}>
            {upcoming.map((o, i) => (
              <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <span style={{ flex: 1, fontSize: 13 }}>{fmtDate(o.slot!.date)} · {o.slot!.window}</span>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{db.localities.find((l) => l.id === o.address.localityId)?.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p style={{ ...small, textAlign: "center", fontSize: 11, marginTop: 16 }}>Tip: place an order from <a href="/customer" target="_blank" style={{ color: "var(--blue)", fontWeight: 700 }}>/customer</a> in another tab to receive a request here.</p>
    </div>
  );
}

/* ───────────────────────── Active job ───────────────────────── */

function JobPage({ o, me, onBack, flash }: { o: Order; me: Driver; onBack: () => void; flash: (m: string) => void }) {
  const db = useData();
  const now = useNow(1000);
  const cust = db.customers.find((c) => c.id === o.customerId);
  const vendor = db.vendors.find((v) => v.id === o.vendorId);
  const [returned, setReturned] = useState(o.cans.expected);
  const [cashOk, setCashOk] = useState(false);
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const pos = driverPos(o, me, now) ?? me.loc;
  const target = o.status === "Accepted" && vendor ? vendor.location : o.address.pt;

  const act = (to: "Pickup" | "Out for Delivery" | "Arrived") => update((d) => { const x = d.orders.find((y) => y.id === o.id)!; if (x.status === o.status) advance(d, x, to, Date.now()); });
  const finish = () => {
    if (otp !== o.otp) { setErr("OTP doesn't match — ask the customer to check their app"); return; }
    if (o.payment.method === "COD" && !cashOk) { setErr(`Confirm you collected ${inr(o.total)} in cash`); return; }
    update((d) => { const x = d.orders.find((y) => y.id === o.id)!; if (x.status !== "Arrived") return false; completeDelivery(d, x, { returned, photo, now: Date.now() }); });
    flash("Delivery completed 🎉");
    onBack();
  };

  if (DONE.includes(o.status) || o.status === "Cancelled") {
    return (
      <div className="fade-up">
        <PageHeader title={`#${o.id}`} onBack={onBack} right={<StatusBadge status={o.status} />} />
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...card, padding: 14 }}>
            {o.items.map((i) => <Line key={i.skuId} k={`${i.qty} × ${i.name}`} v={inr(i.price * i.qty)} />)}
            <Line k={`Payment · ${o.payment.method}`} v={o.payment.status} />
            <Line k="Cans returned" v={`${o.cans.returned ?? "—"} / ${o.cans.expected}`} />
            <Line k="Your payout" v={inr(payout(o))} strong />
            {o.cancel && <p style={small}>Cancelled by {o.cancel.by}: {o.cancel.reason}</p>}
            {o.rating && <p style={small}>Customer rated you ★ {o.rating.driver}{o.rating.comment ? ` — “${o.rating.comment}”` : ""}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <PageHeader title="Order Details" onBack={onBack} right={<StatusBadge status={o.status} />} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <CityMap height={navOpen ? 330 : 200} fit={[pos, target]} route={o.status === "Arrived" ? undefined : route(pos, target)} localities={db.localities.filter((l) => l.cityId === "noida")} showLabels={navOpen}
            markers={[{ id: "me", pt: pos, kind: "driver" }, { id: "dst", pt: o.address.pt, kind: "home", label: "Customer" }, ...(vendor ? [{ id: "v", pt: vendor.location, kind: "vendor" as const, label: o.status === "Accepted" ? "Pickup" : undefined }] : [])]} />
          <div style={{ position: "absolute", top: 10, left: 10, right: 10, background: "var(--blue-dark)", color: "white", borderRadius: 12, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <NavigateIcon s={18} c="white" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{o.status === "Accepted" ? `Head to ${vendor?.name ?? "vendor"}` : o.status === "Arrived" ? "You've arrived" : "Head to customer"}</span>
            <span style={{ marginLeft: "auto", fontSize: 12 }}>{distKm(pos, target).toFixed(1)} km</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <GhostButton onClick={() => setNavOpen((v) => !v)} style={{ padding: 10, fontSize: 13 }}><NavigateIcon s={16} c="var(--ink)" /> {navOpen ? "Hide map" : "Navigate"}</GhostButton>
          <a href={`tel:${cust?.phone}`} style={{ ...card, flex: 1, padding: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none", color: "var(--ink)", fontSize: 13, fontWeight: 600, border: "1.5px solid var(--line-strong)", boxShadow: "none", borderRadius: 16 }}><PhoneIcon s={16} c="var(--go)" /> Call customer</a>
        </div>

        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>#{o.id}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>{fmtTime(o.createdAt)}</p>
          </div>
          {o.items.map((i) => (
            <div key={i.skuId} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ProductArt art={db.skus.find((s) => s.id === i.skuId)?.art ?? "can20"} size={38} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{i.qty} × {i.name}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--line)", margin: "10px 0 8px" }} />
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-mute)", fontWeight: 700 }}>CUSTOMER</p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{cust?.name} · {cust ? maskPhone(cust.phone) : ""}</p>
          <p style={{ ...small, margin: 0 }}>{o.address.line}, {db.localities.find((l) => l.id === o.address.localityId)?.name} · {o.address.pin}</p>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Pill tone={o.payment.method === "COD" ? "amber" : "green"}>{o.payment.method === "COD" ? `Collect ${inr(o.total)} cash` : o.payment.method === "Subscription" ? "Subscription" : "Paid online"}</Pill>
            {o.cans.expected > 0 && <Pill tone="blue">Collect {o.cans.expected} empty can{o.cans.expected > 1 ? "s" : ""}</Pill>}
          </div>
        </div>

        {/* Steps */}
        <div style={{ ...card, padding: "10px 14px" }}>
          {(["Accepted", "Pickup", "Out for Delivery", "Arrived", "Delivered"] as const).map((s) => {
            const at = o.timeline.find((t) => t.status === s)?.at;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: at ? "var(--go)" : "var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>{at && <CheckIcon s={11} c="white" />}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: at ? 600 : 500, color: at ? "var(--ink)" : "var(--ink-mute)" }}>{s === "Pickup" ? "Picked up" : s === "Out for Delivery" ? "On the way" : s}</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{at ? fmtTime(at) : ""}</span>
              </div>
            );
          })}
        </div>

        {o.status === "Arrived" && (
          <div className="fade-up" style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            {o.cans.expected > 0 && (
              <div>
                <p style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}><CanIcon s={17} c="var(--teal-text)" /> Empty cans collected</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Expected {o.cans.expected}</span>
                  <Stepper value={returned} max={o.cans.expected} onChange={setReturned} />
                </div>
                {returned < o.cans.expected && <p style={{ ...small, color: "var(--warning-text)", fontWeight: 600 }}>{o.cans.expected - returned} can(s) short — recorded against the customer&apos;s can balance.</p>}
              </div>
            )}
            {o.payment.method === "COD" ? (
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                <input type="checkbox" checked={cashOk} onChange={(e) => { setCashOk(e.target.checked); setErr(null); }} style={{ width: 20, height: 20 }} />
                I collected {inr(o.total)} in cash
              </label>
            ) : <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--success-text)" }}>✓ Payment {o.payment.method === "Subscription" ? "covered by subscription" : `received online (${o.payment.method})`}</p>}
            <div>
              <label style={label} htmlFor="j-otp">Customer OTP</label>
              <input id="j-otp" inputMode="numeric" value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(null); }} style={{ ...field, fontSize: 22, fontWeight: 800, letterSpacing: "0.5em", textAlign: "center" }} />
              <p style={{ ...small, fontSize: 11 }}>Demo: the OTP is shown in the customer&apos;s tracking screen ({o.otp}).</p>
            </div>
            <button onClick={() => setPhoto((p) => !p)} style={{ border: `1.5px dashed ${photo ? "var(--go)" : "var(--line-strong)"}`, background: photo ? "var(--success)" : "var(--surface)", borderRadius: 14, padding: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontWeight: 600, fontSize: 13.5, color: photo ? "var(--success-text)" : "var(--ink)" }}>
              <CameraIcon s={18} c={photo ? "var(--success-text)" : "var(--ink)"} /> {photo ? "Photo captured ✓ (tap to remove)" : "Add delivery photo (optional)"}
            </button>
            {err && <p role="alert" style={{ margin: 0, color: "var(--error-text)", fontSize: 12.5, fontWeight: 600 }}>{err}</p>}
          </div>
        )}
      </div>
      <Footer>
        {o.status === "Accepted" && <PrimaryButton onClick={() => act("Pickup")}>Picked up water from vendor</PrimaryButton>}
        {o.status === "Pickup" && <PrimaryButton onClick={() => act("Out for Delivery")}>Start delivery</PrimaryButton>}
        {o.status === "Out for Delivery" && <PrimaryButton onClick={() => act("Arrived")}>I&apos;ve arrived</PrimaryButton>}
        {o.status === "Arrived" && <PrimaryButton tone="go" disabled={otp.length !== 4} onClick={finish}>Verify OTP &amp; complete</PrimaryButton>}
      </Footer>
    </div>
  );
}

/* ───────────────────────── History / earnings / profile ───────────────────────── */

function HistoryTab({ me, onOpen }: { me: Driver; onOpen: (id: string) => void }) {
  const db = useData();
  const [range, setRange] = useState<"today" | "week" | "all">("week");
  const from = range === "today" ? startOfDay(Date.now()) : range === "week" ? Date.now() - 7 * DAY : 0;
  const list = db.orders.filter((o) => o.driverId === me.id && (DONE.includes(o.status) || o.status === "Cancelled") && o.createdAt >= from);
  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      <h2 style={{ margin: "18px 2px 12px", fontSize: 20, fontWeight: 800 }}>Delivery History</h2>
      <Tabs tabs={[{ id: "today", label: "Today" }, { id: "week", label: "7 days" }, { id: "all", label: "All" }]} value={range} onChange={setRange} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {list.map((o) => (
          <button key={o.id} onClick={() => onOpen(o.id)} className="press" style={{ ...card, border: "none", cursor: "pointer", textAlign: "left", padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>#{o.id} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
              <p style={{ ...small, margin: 0, fontSize: 11.5 }}>{fmtDT(o.createdAt)} · {o.payment.method}{o.rating ? ` · ★ ${o.rating.driver}` : ""}</p>
            </div>
            <StatusBadge status={o.status} />
          </button>
        ))}
        {!list.length && <Empty title="No deliveries in this period" />}
      </div>
    </div>
  );
}

function EarningsTab({ me }: { me: Driver }) {
  const db = useData();
  const t0 = startOfDay(Date.now());
  const days = Array.from({ length: 7 }, (_, i) => t0 - (6 - i) * DAY);
  const done = db.orders.filter((o) => o.driverId === me.id && DONE.includes(o.status));
  const series = days.map((d) => { const os = done.filter((o) => o.createdAt >= d && o.createdAt < d + DAY); return { d, n: os.length, v: os.reduce((s, o) => s + payout(o), 0), cash: os.filter((o) => o.payment.method === "COD").reduce((s, o) => s + o.total, 0) }; });
  const max = Math.max(1, ...series.map((s) => s.v));
  const week = series.reduce((s, x) => s + x.v, 0);
  const ratings = done.filter((o) => o.rating).map((o) => o.rating!.driver);
  const today = series[6];
  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      <h2 style={{ margin: "18px 2px 12px", fontSize: 20, fontWeight: 800 }}>Earnings & Collections</h2>
      <div style={{ borderRadius: 20, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white" }}>
        <p style={{ margin: 0, fontSize: 12.5, opacity: 0.8 }}>Last 7 days</p>
        <p style={{ margin: "2px 0 12px", fontSize: 28, fontWeight: 800 }}>{inr(week)}</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
          {series.map((s, i) => (
            <div key={s.d} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
              <div title={inr(s.v)} style={{ width: "100%", height: `${Math.max(4, (s.v / max) * 100)}%`, borderRadius: 5, background: i === 6 ? "var(--gold)" : "rgba(255,255,255,0.55)" }} />
              <span style={{ fontSize: 10, opacity: 0.85 }}>{new Date(s.d).toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...card, padding: 14, marginTop: 12 }}>
        <Line k="Deliveries today" v={today.n} />
        <Line k="Earned today" v={inr(today.v)} />
        <Line k="Cash collected today (deposit with vendor)" v={inr(today.cash)} />
        <Line k="Average rating" v={ratings.length ? `★ ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)} (${ratings.length})` : "—"} />
        <p style={{ ...small, fontSize: 11 }}>Payout rule: {inr(20)} per delivery + {inr(5)} per extra can. Settled weekly by {db.vendors.find((v) => v.id === me.vendorId)?.name}.</p>
      </div>
    </div>
  );
}

function DriverProfile({ me, onLogout }: { me: Driver; onLogout: () => void }) {
  const db: DB = useData();
  const v = db.vendors.find((x) => x.id === me.vendorId)!;
  const vh = db.vehicles.find((x) => x.id === me.vehicleId);
  const delivered = db.orders.filter((o) => o.driverId === me.id && DONE.includes(o.status)).length;
  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 2px 16px" }}>
        <Avatar initials={initials(me.name)} size={58} />
        <div>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{me.name}</p>
          <p style={{ ...small, margin: 0 }}>+91 {me.phone} · {delivered} deliveries</p>
        </div>
      </div>
      <div style={{ ...card, padding: 14 }}>
        <Line k="Vendor" v={v.name} />
        <Line k="Vehicle" v={vh ? `${vh.number} · ${vh.type}` : "Not assigned"} />
        <Line k="Capacity" v={vh ? `${vh.capacity} cans` : "—"} />
        <Line k="Driving licence" v={me.licence} />
        <Line k="ID proof" v={me.idProof} />
        <Line k="Verification" v={<Pill tone={me.kyc === "Verified" ? "green" : "amber"}>{me.kyc}</Pill>} />
        <Line k="Member since" v={fmtDate(me.joinedAt)} />
      </div>
      <p style={{ ...small, fontSize: 11.5, margin: "10px 4px" }}>To change your details or vehicle, contact your vendor.</p>
      <GhostButton danger onClick={onLogout}>Log out</GhostButton>
      <DemoLinks />
    </div>
  );
}
