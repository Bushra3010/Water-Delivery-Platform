"use client";

import { useState } from "react";
import CityMap from "../components/CityMap";
import { DAY, downloadCsv, driverBlockers, fmtDT, fmtDate, inr, startOfDay } from "../lib/logic";
import { useData, useNow } from "../lib/store";
import type { Order } from "../lib/types";
import { avg, bucketStatus, daily, gmv, inRange, isDone, trend } from "../web/analytics";
import { Badge, Btn, Filter, LineChart, ORDER_TONE, Panel, SBadge, SearchBox, ShareBars, Stat, Table, muted } from "../web/kit";
import { OrderModal } from "../web/OrderModal";
import type { VProps } from "./VendorApp";

export function vendorOrders(orders: Order[], vid: string) {
  return orders.filter((o) => o.vendorId === vid || (!o.vendorId && o.attempts.some((a) => a.vendorId === vid)));
}

export function VendorDashboard({ vendorId, go, actor, toast }: VProps) {
  const db = useData();
  const now = useNow(5000);
  const [open, setOpen] = useState<string | null>(null);
  const v = db.vendors.find((x) => x.id === vendorId)!;
  const os = vendorOrders(db.orders, vendorId);
  const t0 = startOfDay(now);
  const today = inRange(os, t0), lastWeekDay = inRange(os, t0 - 7 * DAY, t0 - 6 * DAY);
  const drivers = db.drivers.filter((d) => d.vendorId === vendorId);
  const online = drivers.filter((d) => d.online && d.status === "Active");
  const myPlans = db.plans.filter((p) => p.owner === vendorId).map((p) => p.id);
  const subs = db.subs.filter((s) => myPlans.includes(s.planId) && s.status === "Active");
  const products = db.products.filter((p) => p.vendorId === vendorId);
  const rated = os.filter((o) => o.rating);
  const skuSales = db.skus.map((s) => ({ label: s.name, v: os.filter(isDone).reduce((a, o) => a + o.items.filter((i) => i.skuId === s.id).reduce((b, i) => b + i.qty, 0), 0) })).filter((x) => x.v).sort((a, b) => b.v - a.v);
  const alerts = [
    { n: os.filter((o) => o.status === "Failed Assignment" && o.createdAt > now - DAY).length, label: "Failed assignments (24h)", to: "orders" as const, tone: "red" as const },
    { n: drivers.filter((d) => d.kyc === "Pending").length, label: "Drivers awaiting verification", to: "drivers" as const, tone: "amber" as const },
    { n: products.filter((p) => !p.inStock && p.active).length, label: "Products out of stock", to: "products" as const, tone: "amber" as const },
    { n: v.planExpiry && v.planExpiry - now < 10 * DAY ? 1 : 0, label: v.planExpiry < now ? `Platform plan expired ${fmtDate(v.planExpiry)}` : `Platform plan renews ${fmtDate(v.planExpiry)}`, to: "settings" as const, tone: "purple" as const },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat icon="🧾" label="Today's orders" value={String(today.length)} sub={trend(today.length, lastWeekDay.length)} tone="blue" />
        <Stat icon="💰" label="Today's sales" value={inr(gmv(today))} sub={trend(gmv(today), gmv(lastWeekDay))} tone="green" />
        <Stat icon="🧑‍✈️" label="Active drivers" value={String(online.length)} sub={`${online.filter((d) => driverBlockers(db, d).includes("On a delivery")).length} on delivery · ${drivers.length} total`} tone="purple" />
        <Stat icon="🔁" label="Active subscriptions" value={String(subs.length)} sub={`${myPlans.length} plan(s)`} tone="amber" />
      </div>
      <div className="admin-grid-2">
        <Panel title="Sales overview · 14 days" actions={<b style={{ fontSize: 13 }}>{inr(gmv(inRange(os, t0 - 13 * DAY)))}</b>}>
          <LineChart data={daily(os, 14, gmv, now)} fmt={(n) => (n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${n}`)} />
        </Panel>
        <Panel title="Needs attention">
          {alerts.map((a) => (
            <button key={a.label} onClick={() => go(a.to)} className="admin-row" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 10, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
              <Badge tone={a.n ? a.tone : "grey"}>{a.n}</Badge>
              <span style={{ flex: 1, fontSize: 13, color: a.n ? "var(--ink)" : "var(--ink-mute)" }}>{a.label}</span><span style={muted}>›</span>
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Avg rating</span><b>★ {avg(rated.map((o) => o.rating!.vendor)).toFixed(2)} <span style={muted}>({rated.length})</span></b>
          </div>
        </Panel>
      </div>
      <div className="admin-grid-2">
        <Panel title="Recent orders" pad={false} actions={<Btn safe kind="ghost" small onClick={() => go("orders")}>View all</Btn>}>
          <Table rows={os.slice(0, 7)} rowKey={(o) => o.id} onRow={(o) => setOpen(o.id)} pageSize={7} cols={[
            { key: "id", head: "Order", render: (o) => <b>#{o.id}</b> },
            { key: "i", head: "Items", render: (o) => <span style={muted}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span> },
            { key: "a", head: "Amount", align: "right", render: (o) => inr(o.total) },
            { key: "s", head: "Status", render: (o) => <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge> },
          ]} />
        </Panel>
        <Panel title="Fleet right now">
          <CityMap height={200} fit={[v.location, ...drivers.map((d) => d.loc)]} localities={db.localities.filter((l) => l.cityId === v.cityId)}
            areas={v.area.radiusKm ? [{ kind: "circle", c: v.location, r: v.area.radiusKm * 100, color: "#16a34a" }] : v.area.polygon ? [{ kind: "poly", pts: v.area.polygon, color: "#16a34a" }] : []}
            markers={[{ id: "v", pt: v.location, kind: "vendor" }, ...drivers.filter((d) => d.status === "Active").map((d) => ({ id: d.id, pt: d.loc, kind: d.online ? "driver" as const : "approx" as const, label: d.name.split(" ")[0] }))]} />
          <div style={{ marginTop: 12 }}><ShareBars rows={skuSales.slice(0, 4)} fmt={(n) => `${n} units`} /></div>
        </Panel>
      </div>
      {open && <OrderModal id={open} onClose={() => setOpen(null)} actor={actor} vendorId={vendorId} toast={toast} />}
    </div>
  );
}

const BUCKETS = ["All", "Requested", "Scheduled", "Accepted", "In progress", "Delivered", "Cancelled", "Failed"] as const;
const RANGES = { Today: 0, "7 days": 7, "30 days": 30, All: 3650 } as const;

export function VendorOrders({ vendorId, actor, toast }: VProps) {
  const db = useData();
  const now = useNow(3000);
  const [b, setB] = useState<(typeof BUCKETS)[number]>("All");
  const [range, setRange] = useState<keyof typeof RANGES>("7 days");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const from = range === "Today" ? startOfDay(now) : now - RANGES[range] * DAY;
  const base = vendorOrders(db.orders, vendorId).filter((o) => o.createdAt >= from || o.status === "Placed");
  const counts = Object.fromEntries(BUCKETS.map((x) => [x, x === "All" ? base.length : base.filter((o) => bucketStatus(o) === x).length]));
  const cust = (id: string) => db.customers.find((c) => c.id === id)?.name ?? "";
  const rows = base.filter((o) => (b === "All" || bucketStatus(o) === b) && (!q || o.id.toLowerCase().includes(q.toLowerCase()) || cust(o.customerId).toLowerCase().includes(q.toLowerCase())));

  return (
    <Panel pad={false} title={<Filter options={BUCKETS} value={b} onChange={setB} counts={counts} />} actions={
      <>
        <Filter options={Object.keys(RANGES) as (keyof typeof RANGES)[]} value={range} onChange={setRange} />
        <SearchBox value={q} onChange={setQ} placeholder="Search order or customer" />
        <Btn safe kind="ghost" small onClick={() => downloadCsv(`orders-${vendorId}.csv`, rows.map((o) => ({ order: o.id, placed: fmtDT(o.createdAt), customer: cust(o.customerId), items: o.items.map((i) => `${i.qty}x ${i.name}`).join("; "), driver: db.drivers.find((d) => d.id === o.driverId)?.name ?? "", total: o.total, tax: o.tax, payment: o.payment.method, payment_status: o.payment.status, status: o.status })))}>Export CSV</Btn>
      </>
    }>
      <Table rows={rows} rowKey={(o) => o.id} onRow={(o) => setOpen(o.id)} pageSize={12} empty="No orders match." cols={[
        { key: "id", head: "Order", render: (o) => <div><b>#{o.id}</b><div style={muted}>{o.slot ? `${fmtDate(o.slot.date)} ${o.slot.window}` : fmtDT(o.createdAt)}</div></div> },
        { key: "c", head: "Customer", render: (o) => <div>{cust(o.customerId)}<div style={muted}>{db.localities.find((l) => l.id === o.address.localityId)?.name}</div></div> },
        { key: "i", head: "Items", render: (o) => <span style={muted}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span> },
        { key: "d", head: "Driver", render: (o) => db.drivers.find((d) => d.id === (o.driverId ?? o.offer?.driverId))?.name ?? <span style={muted}>—</span> },
        { key: "a", head: "Amount", align: "right", render: (o) => <div>{inr(o.total)}<div style={muted}>{o.payment.method}</div></div> },
        { key: "p", head: "Payment", render: (o) => <SBadge s={o.payment.status} /> },
        { key: "s", head: "Status", render: (o) => <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge> },
      ]} />
      {open && <OrderModal id={open} onClose={() => setOpen(null)} actor={actor} vendorId={vendorId} toast={toast} />}
    </Panel>
  );
}
