"use client";

import { useState } from "react";
import CityMap from "../components/CityMap";
import { audit, notify } from "../lib/actions";
import { DAY, FINDING, LIVE, downloadCsv, fmtDT, fmtDate, inr, startOfDay, walletBalance } from "../lib/logic";
import { update, useData, useNow } from "../lib/store";
import type { AccountStatus, Customer, Driver, KycStatus } from "../lib/types";
import { bucketStatus, daily, gmv, inRange, isDone, pct, trend } from "../web/analytics";
import { Badge, Btn, Donut, Filter, Initials, KV, LineChart, Modal, ORDER_TONE, Panel, SBadge, SearchBox, ShareBars, Stat, Table, input, muted } from "../web/kit";
import { OrderModal } from "../web/OrderModal";
import { DriverDetail, availability, driverStats } from "../vendor/VendorFleet";
import type { AProps } from "./AdminApp";

/* ───────────────────────── Dashboard ───────────────────────── */

export function AdminDashboard({ go, actor, toast, role }: AProps) {
  const db = useData();
  const now = useNow(5000);
  const [open, setOpen] = useState<string | null>(null);
  const t0 = startOfDay(now);
  const month = inRange(db.orders, now - 30 * DAY), prevMonth = inRange(db.orders, now - 60 * DAY, now - 30 * DAY);
  const week = inRange(db.orders, now - 7 * DAY), prevWeek = inRange(db.orders, now - 14 * DAY, now - 7 * DAY);
  const activeCust = new Set(month.map((o) => o.customerId)).size;
  const done = month.filter(isDone);
  const firstTry = done.filter((o) => o.attempts.length && (o.attempts[0].result === "Accepted" || o.attempts[0].result === "Manual")).length;
  const payParts = ["COD", "UPI", "Wallet", "Subscription"].map((m) => ({ label: m, v: done.filter((o) => o.payment.method === m).length })).filter((p) => p.v);
  const topVendors = db.vendors.map((v) => ({ label: v.name, v: gmv(month.filter((o) => o.vendorId === v.id)) })).filter((x) => x.v).sort((a, b) => b.v - a.v).slice(0, 5);
  const live = db.orders.filter((o) => FINDING.includes(o.status) && o.status !== "Placed" || LIVE.includes(o.status));
  const activity = [...db.audit.slice(0, 5).map((a) => ({ at: a.at, t: a.action, b: `${a.target} · ${a.actor}` })), ...db.notices.filter((n) => n.to === "admin").slice(0, 5).map((n) => ({ at: n.at, t: n.title, b: n.body }))].sort((a, b) => b.at - a.at).slice(0, 7);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat icon="🧾" label="Orders · 7 days" value={String(week.length)} sub={trend(week.length, prevWeek.length)} tone="blue" />
        <Stat icon="💰" label="GMV · 30 days" value={inr(gmv(month))} sub={trend(gmv(month), gmv(prevMonth)).replace("week", "month")} tone="green" />
        <Stat icon="👥" label="Active customers · 30d" value={String(activeCust)} sub={`${db.customers.length} registered`} tone="purple" />
        <Stat icon="🔁" label="Active subscriptions" value={String(db.subs.filter((s) => s.status === "Active").length)} sub={`${db.plans.filter((p) => p.active).length} live plans`} tone="amber" />
      </div>
      <div className="admin-grid-4">
        <Stat label="Vendors active / total" value={`${db.vendors.filter((v) => v.status === "Active").length} / ${db.vendors.length}`} sub={`${db.vendors.filter((v) => v.status === "Pending").length} pending approval`} tone="blue" />
        <Stat label="Drivers online" value={`${db.drivers.filter((d) => d.online && d.status === "Active").length} / ${db.drivers.length}`} sub={`${db.drivers.filter((d) => d.kyc === "Pending").length} KYC pending`} tone="green" />
        <Stat label="First-driver acceptance" value={`${pct(firstTry, done.length)}%`} sub={`${month.filter((o) => o.status === "Failed Assignment").length} failed assignments · 30d`} tone="purple" />
        <Stat label="Cancellation rate" value={`${pct(month.filter((o) => o.status === "Cancelled").length, month.length)}%`} sub={`today ${inRange(db.orders, t0).filter((o) => o.status === "Cancelled").length}`} tone="red" />
      </div>
      <div className="admin-grid-2">
        <Panel title="Order trend · 30 days"><LineChart data={daily(db.orders, 30, (os) => os.length, now)} /></Panel>
        <Panel title="Payment methods · 30 days"><Donut parts={payParts} center={String(done.length)} /></Panel>
      </div>
      <div className="admin-grid-2">
        <Panel title={`Live operations (${live.length})`} actions={<Btn safe kind="ghost" small onClick={() => go("orders")}>Dispatch board</Btn>}>
          <CityMap height={250} localities={db.localities.filter((l) => l.cityId === "noida")}
            markers={[
              ...db.vendors.filter((v) => v.status === "Active").map((v) => ({ id: v.id, pt: v.location, kind: "vendor" as const })),
              ...db.drivers.filter((d) => d.online && d.status === "Active").map((d) => ({ id: d.id, pt: d.loc, kind: "driver" as const })),
              ...live.map((o) => ({ id: o.id, pt: o.address.pt, kind: "pin" as const })),
            ]} />
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {live.slice(0, 5).map((o) => (
              <button key={o.id} onClick={() => setOpen(o.id)} className="admin-row" style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 8px", border: "none", background: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 12.5 }}>
                <b>#{o.id}</b><span style={{ flex: 1, ...muted }}>{o.address.line}</span><Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge>
              </button>
            ))}
          </div>
        </Panel>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Top vendors by GMV · 30d"><ShareBars rows={topVendors} fmt={inr} /></Panel>
          <Panel title="Recent activity">
            {activity.map((a, i) => (
              <div key={i} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{a.t}</p>
                <p style={{ margin: 0, ...muted }}>{a.b} · {fmtDT(a.at)}</p>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      {open && <OrderModal id={open} onClose={() => setOpen(null)} actor={actor} canRefund={role.sections.includes("payments")} toast={toast} />}
    </div>
  );
}

/* ───────────────────────── Orders & dispatch ───────────────────────── */

const BUCKETS = ["All", "Requested", "Scheduled", "Accepted", "In progress", "Delivered", "Cancelled", "Failed"] as const;

export function AdminOrders({ actor, toast, role }: AProps) {
  const db = useData();
  const now = useNow(1000);
  const [b, setB] = useState<(typeof BUCKETS)[number]>("All");
  const [vendor, setVendor] = useState("all");
  const [pay, setPay] = useState("all");
  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const base = db.orders.filter((o) => (o.createdAt >= now - days * DAY || o.status === "Placed") && (vendor === "all" || o.vendorId === vendor || o.attempts.some((a) => a.vendorId === vendor)) && (pay === "all" || o.payment.method === pay));
  const counts = Object.fromEntries(BUCKETS.map((x) => [x, x === "All" ? base.length : base.filter((o) => bucketStatus(o) === x).length]));
  const cust = (id: string) => db.customers.find((c) => c.id === id)?.name ?? "";
  const rows = base.filter((o) => (b === "All" || bucketStatus(o) === b) && (!q || o.id.toLowerCase().includes(q.toLowerCase()) || cust(o.customerId).toLowerCase().includes(q.toLowerCase())));
  const searching = db.orders.filter((o) => o.status === "Searching" || o.status === "Assigned");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title={`Live dispatch board · ${searching.length} searching`} actions={<span style={muted}>Timeout {db.settings.dispatchTimeoutSec}s · max {db.settings.maxAttempts} drivers · radius {db.settings.searchRadiusKm} km</span>}>
        {searching.length ? searching.map((o) => {
          const d = db.drivers.find((x) => x.id === o.offer?.driverId);
          const left = o.offer ? Math.max(0, Math.ceil((o.offer.until - now) / 1000)) : 0;
          return (
            <button key={o.id} onClick={() => setOpen(o.id)} className="admin-row" style={{ width: "100%", display: "flex", gap: 12, alignItems: "center", padding: "9px 8px", border: "none", background: "none", borderRadius: 10, cursor: "pointer", textAlign: "left", fontSize: 13 }}>
              <b>#{o.id}</b>
              <span style={{ flex: 1 }}>{cust(o.customerId)} · {db.localities.find((l) => l.id === o.address.localityId)?.name}</span>
              <span style={muted}>Attempt {o.attempts.slice(o.roundStart ?? 0).length}: {d ? `${d.name} (${left}s)` : "ranking drivers…"}</span>
              <Badge tone="purple">{o.status}</Badge>
            </button>
          );
        }) : <p style={{ ...muted, margin: 0 }}>No orders are waiting for a driver right now. Place one from the customer app to watch it cascade here.</p>}
      </Panel>
      <Panel pad={false} title={<Filter options={BUCKETS} value={b} onChange={setB} counts={counts} />} actions={
        <>
          <select value={vendor} onChange={(e) => setVendor(e.target.value)} style={{ ...input, width: "auto" }} aria-label="Vendor"><option value="all">All vendors</option>{db.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          <select value={pay} onChange={(e) => setPay(e.target.value)} style={{ ...input, width: "auto" }} aria-label="Payment"><option value="all">All payments</option>{["COD", "UPI", "Wallet", "Subscription"].map((m) => <option key={m}>{m}</option>)}</select>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ ...input, width: "auto" }} aria-label="Range"><option value={1}>24 hours</option><option value={7}>7 days</option><option value={30}>30 days</option></select>
          <SearchBox value={q} onChange={setQ} placeholder="Order or customer" />
          <Btn safe kind="ghost" small onClick={() => downloadCsv("orders.csv", rows.map((o) => ({ order: o.id, placed: fmtDT(o.createdAt), customer: cust(o.customerId), vendor: db.vendors.find((v) => v.id === o.vendorId)?.name ?? "", driver: db.drivers.find((d) => d.id === o.driverId)?.name ?? "", attempts: o.attempts.length, total: o.total, payment: o.payment.method, payment_status: o.payment.status, status: o.status })))}>Export</Btn>
        </>
      }>
        <Table rows={rows} rowKey={(o) => o.id} onRow={(o) => setOpen(o.id)} pageSize={12} cols={[
          { key: "id", head: "Order", render: (o) => <div><b>#{o.id}</b><div style={muted}>{o.slot ? `${fmtDate(o.slot.date)} ${o.slot.window}` : fmtDT(o.createdAt)}</div></div> },
          { key: "c", head: "Customer", render: (o) => cust(o.customerId) },
          { key: "v", head: "Vendor / driver", render: (o) => <div>{db.vendors.find((v) => v.id === o.vendorId)?.name ?? "—"}<div style={muted}>{db.drivers.find((d) => d.id === o.driverId)?.name ?? ""}</div></div> },
          { key: "at", head: "Attempts", align: "center", render: (o) => o.attempts.length },
          { key: "a", head: "Amount", align: "right", render: (o) => <div>{inr(o.total)}<div style={muted}>{o.payment.method}</div></div> },
          { key: "p", head: "Payment", render: (o) => <SBadge s={o.payment.status} /> },
          { key: "s", head: "Status", render: (o) => <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge> },
        ]} />
      </Panel>
      {open && <OrderModal id={open} onClose={() => setOpen(null)} actor={actor} canRefund={role.sections.includes("payments")} toast={toast} />}
    </div>
  );
}

/* ───────────────────────── Customers ───────────────────────── */

export function AdminCustomers({ actor, toast }: AProps) {
  const db = useData();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"All" | "Subscribers" | "Blocked">("All");
  const [view, setView] = useState<Customer | null>(null);
  const subbed = new Set(db.subs.filter((s) => s.status === "Active").map((s) => s.customerId));
  const rows = db.customers.filter((c) => (f === "All" || (f === "Subscribers" && subbed.has(c.id)) || (f === "Blocked" && c.status !== "Active")) && (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)));
  return (
    <Panel pad={false} title={<Filter options={["All", "Subscribers", "Blocked"] as const} value={f} onChange={setF} />} actions={<>
      <SearchBox value={q} onChange={setQ} placeholder="Name or mobile" />
      <Btn safe kind="ghost" small onClick={() => downloadCsv("customers.csv", rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, orders: db.orders.filter((o) => o.customerId === c.id).length, wallet: walletBalance(db, c.id), cans_held: c.cansHeld, status: c.status, joined: fmtDate(c.joinedAt) })))}>Export</Btn>
    </>}>
      <Table rows={rows} rowKey={(c) => c.id} onRow={setView} cols={[
        { key: "n", head: "Customer", render: (c) => <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Initials name={c.name} /><div><b>{c.name}</b><div style={muted}>{c.phone}</div></div></div> },
        { key: "a", head: "Area", render: (c) => { const a = db.addresses.find((x) => x.customerId === c.id && x.isDefault); return <span style={muted}>{db.localities.find((l) => l.id === a?.localityId)?.name ?? "—"}</span>; } },
        { key: "o", head: "Orders", align: "right", render: (c) => db.orders.filter((o) => o.customerId === c.id).length },
        { key: "s", head: "Plan", render: (c) => (subbed.has(c.id) ? <Badge tone="blue">Subscriber</Badge> : <span style={muted}>—</span>) },
        { key: "w", head: "Wallet", align: "right", render: (c) => inr(walletBalance(db, c.id)) },
        { key: "cn", head: "Cans held", align: "right", render: (c) => c.cansHeld },
        { key: "st", head: "Status", render: (c) => <SBadge s={c.status} /> },
      ]} />
      {view && <CustomerDetail c={db.customers.find((x) => x.id === view.id)!} onClose={() => setView(null)} actor={actor} toast={toast} />}
    </Panel>
  );
}

function CustomerDetail({ c, onClose, actor, toast }: { c: Customer; onClose: () => void; actor: AProps["actor"]; toast: (m: string) => void }) {
  const db = useData();
  const [amt, setAmt] = useState("");
  const [why, setWhy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const orders = db.orders.filter((o) => o.customerId === c.id);
  const setStatus = (s: AccountStatus) => { update((d) => { d.customers.find((x) => x.id === c.id)!.status = s; audit(d, actor.name, actor.role, "Customer status changed", c.name, `${c.status} → ${s}`); }); toast(`Customer ${s.toLowerCase()}`); };
  const credit = () => {
    const n = Number(amt);
    if (!n || n > 2000 || why.trim().length < 3) { toast("Enter an amount up to ₹2,000 and a reason"); return; }
    update((d) => { d.wallet.unshift({ id: `w${Date.now()}`, customerId: c.id, amount: n, title: `Credit · ${why.trim()}`, at: Date.now(), ref: actor.name }); audit(d, actor.name, actor.role, "Wallet credit", c.name, `${inr(n)} — ${why.trim()}`); notify(d, `customer:${c.id}`, `${inr(n)} added to your wallet`, why.trim()); });
    setAmt(""); setWhy(""); toast("Wallet credited");
  };
  return (
    <Modal wide title={c.name} onClose={onClose} footer={<>
      {c.status === "Active" ? <Btn kind="danger" onClick={() => setStatus("Blocked")}>Block customer</Btn> : <Btn kind="go" onClick={() => setStatus("Active")}>Unblock</Btn>}
      <Btn safe kind="ghost" onClick={onClose}>Close</Btn>
    </>}>
      <div className="admin-grid-even">
        <div>
          <KV k="Mobile" v={<span>{c.phone} · <a href={`tel:${c.phone}`}>Call</a> · <a href={`https://wa.me/91${c.phone}`} target="_blank" rel="noreferrer">WhatsApp</a></span>} />
          <KV k="Language" v={db.settings.languages.find((l) => l.code === c.lang)?.name} />
          <KV k="Joined" v={fmtDate(c.joinedAt)} />
          <KV k="Status" v={<SBadge s={c.status} />} />
          <KV k="Reusable cans held" v={c.cansHeld} />
          <KV k="Wallet balance" v={inr(walletBalance(db, c.id))} />
          <p style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 700 }}>Addresses</p>
          {db.addresses.filter((a) => a.customerId === c.id).map((a) => <KV key={a.id} k={a.label + (a.isDefault ? " (default)" : "")} v={`${a.line}, ${a.pin}`} />)}
          <p style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 700 }}>Subscriptions</p>
          {db.subs.filter((s) => s.customerId === c.id).map((s) => { const p = db.plans.find((x) => x.id === s.planId)!; return <KV key={s.id} k={p.name} v={<span>{p.entitlement + s.carried - s.used} left · till {fmtDate(s.end)} <SBadge s={s.status} /></span>} />; })}
          <p style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 700 }}>Wallet credit (goodwill)</p>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} placeholder="₹" style={{ ...input, width: 80 }} aria-label="Amount" />
            <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason" style={input} aria-label="Reason" />
            <Btn onClick={credit}>Credit</Btn>
          </div>
        </div>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>Orders ({orders.length})</p>
          <Table rows={orders} rowKey={(o) => o.id} pageSize={7} onRow={(o) => setOpen(o.id)} cols={[
            { key: "o", head: "Order", render: (o) => <div><b>#{o.id}</b><div style={muted}>{fmtDT(o.createdAt)}</div></div> },
            { key: "a", head: "Amount", render: (o) => inr(o.total) },
            { key: "r", head: "Rating", render: (o) => (o.rating ? `★${o.rating.driver}` : "—") },
            { key: "s", head: "Status", render: (o) => <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge> },
          ]} />
          <p style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 700 }}>Wallet activity</p>
          {db.wallet.filter((w) => w.customerId === c.id).slice(0, 6).map((w) => <KV key={w.id} k={`${w.title} · ${fmtDate(w.at)}`} v={`${w.amount > 0 ? "+" : "−"}${inr(Math.abs(w.amount))}`} />)}
        </div>
      </div>
      {open && <OrderModal id={open} onClose={() => setOpen(null)} actor={actor} canRefund toast={toast} />}
    </Modal>
  );
}

/* ───────────────────────── Drivers ───────────────────────── */

export function AdminDrivers({ actor, toast }: AProps) {
  const db = useData();
  const [vendor, setVendor] = useState("all");
  const [f, setF] = useState<"All" | "KYC pending" | "Online" | "Suspended">("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<Driver | null>(null);
  const rows = db.drivers.filter((d) => (vendor === "all" || d.vendorId === vendor) && (f === "All" || (f === "KYC pending" && d.kyc === "Pending") || (f === "Online" && d.online) || (f === "Suspended" && d.status === "Suspended")) && (!q || d.name.toLowerCase().includes(q.toLowerCase()) || d.phone.includes(q)));
  const verify = (d: Driver, k: KycStatus) => {
    update((x) => {
      const y = x.drivers.find((z) => z.id === d.id)!;
      y.kyc = k;
      if (k === "Verified" && y.status === "Pending") y.status = "Active";
      if (k === "Rejected") { y.status = "Inactive"; y.online = false; }
      audit(x, actor.name, actor.role, "Driver KYC reviewed", d.name, k);
      notify(x, `vendor:${d.vendorId}`, `Driver ${k === "Verified" ? "verified" : "rejected"}`, `${d.name}'s verification: ${k}.`);
    });
    toast(`${d.name}: KYC ${k.toLowerCase()}`);
  };
  const exceptions = db.orders.filter((o) => o.cans.note && o.createdAt > Date.now() - 7 * DAY);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel pad={false} title={<Filter options={["All", "KYC pending", "Online", "Suspended"] as const} value={f} onChange={setF} counts={{ "KYC pending": db.drivers.filter((d) => d.kyc === "Pending").length }} />} actions={<>
        <select value={vendor} onChange={(e) => setVendor(e.target.value)} style={{ ...input, width: "auto" }} aria-label="Vendor"><option value="all">All vendors</option>{db.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <SearchBox value={q} onChange={setQ} placeholder="Name or mobile" />
      </>}>
        <Table rows={rows} rowKey={(d) => d.id} onRow={setView} cols={[
          { key: "n", head: "Driver", render: (d) => <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Initials name={d.name} /><div><b>{d.name}</b><div style={muted}>{d.phone}</div></div></div> },
          { key: "v", head: "Vendor", render: (d) => db.vendors.find((v) => v.id === d.vendorId)?.name },
          { key: "k", head: "Verification", render: (d) => <div><SBadge s={d.kyc} /><div style={muted}>{d.licence}</div></div> },
          { key: "s", head: "Account", render: (d) => <SBadge s={d.status} /> },
          { key: "a", head: "Availability", render: (d) => availability(db, d) },
          { key: "p", head: "Delivered / ★", render: (d) => { const s = driverStats(db, d.id); return `${s.done} · ${s.rating ? s.rating.toFixed(1) : "—"} · ${s.acceptance}% acc.`; } },
          { key: "x", head: "", align: "right", render: (d) => d.kyc === "Pending" ? <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><Btn kind="go" small onClick={() => verify(d, "Verified")}>Verify</Btn><Btn kind="danger" small onClick={() => verify(d, "Rejected")}>Reject</Btn></div> : null },
        ]} />
      </Panel>
      <Panel pad={false} title={`Delivery exceptions · 7 days (${exceptions.length})`}>
        <Table rows={exceptions} rowKey={(o) => o.id} pageSize={6} empty="No can-balance exceptions this week." cols={[
          { key: "o", head: "Order", render: (o) => <b>#{o.id}</b> },
          { key: "d", head: "Driver", render: (o) => db.drivers.find((d) => d.id === o.driverId)?.name },
          { key: "c", head: "Cans", render: (o) => `${o.cans.returned}/${o.cans.expected} returned` },
          { key: "n", head: "Note", render: (o) => <span style={muted}>{o.cans.note}</span> },
        ]} />
      </Panel>
      {view && <DriverDetail d={db.drivers.find((x) => x.id === view.id)!} onClose={() => setView(null)} />}
    </div>
  );
}

