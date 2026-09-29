"use client";

import { useState } from "react";
import { audit, notify } from "../lib/actions";
import { DAY, commissionOf, downloadCsv, fmtDT, fmtDate, inr } from "../lib/logic";
import { update, useData, useNow } from "../lib/store";
import { avg, bucketStatus, daily, deliveryMins, gmv, inRange, isDone } from "../web/analytics";
import { Badge, Bars, Btn, Donut, Field, Filter, KV, Panel, SBadge, Stat, Table, input, muted } from "../web/kit";
import { driverStats } from "./VendorFleet";
import { vendorOrders } from "./VendorOps";
import type { VProps } from "./VendorApp";

export function VendorPayments({ vendorId }: VProps) {
  const db = useData();
  const now = useNow(10000);
  const v = db.vendors.find((x) => x.id === vendorId)!;
  const done = vendorOrders(db.orders, vendorId).filter((o) => isDone(o) && o.createdAt > now - 30 * DAY);
  const sum = (f: (o: (typeof done)[number]) => number) => done.reduce((s, o) => s + f(o), 0);
  const online = done.filter((o) => o.payment.method === "UPI" || o.payment.method === "Wallet");
  const cod = done.filter((o) => o.payment.method === "COD");
  const commission = sum((o) => commissionOf(v, o));
  const settlements = db.settlements.filter((s) => s.vendorId === vendorId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat icon="📲" label={`Online · ${v.paymentMode === "platform" ? "collected by platform" : "collected by you"}`} value={inr(online.reduce((s, o) => s + o.total, 0))} sub="last 30 days" tone="blue" />
        <Stat icon="💵" label="COD collected by drivers" value={inr(cod.reduce((s, o) => s + o.total, 0))} sub={`${cod.length} orders`} tone="green" />
        <Stat icon="🏷️" label="Platform commission" value={inr(commission)} sub={v.monetization.mode === "subscription" ? "subscription plan — no commission" : `${v.monetization.commissionPct}% per delivery`} tone="purple" />
        <Stat icon="🧾" label="GST on invoices" value={inr(sum((o) => o.tax))} sub={v.gstin ? `GSTIN ${v.gstin}` : "Not GST-registered"} tone="amber" />
      </div>
      <Panel pad={false} title="Settlements" actions={<span style={muted}>{v.paymentMode === "platform" ? "Platform collects online payments and releases your share after Super Admin approval." : "You collect payments directly — commission is invoiced separately."}</span>}>
        <Table rows={settlements} rowKey={(s) => s.id} empty={v.paymentMode === "direct" ? "Direct-collection vendors don't receive settlements." : "No settlements yet."} cols={[
          { key: "id", head: "Settlement", render: (s) => <b>{s.id}</b> },
          { key: "p", head: "Period", render: (s) => s.period },
          { key: "o", head: "Orders", align: "right", render: (s) => s.orders },
          { key: "g", head: "Online gross", align: "right", render: (s) => inr(s.gross) },
          { key: "c", head: "Commission", align: "right", render: (s) => `− ${inr(s.commission)}` },
          { key: "n", head: "Net payable", align: "right", render: (s) => <b>{inr(s.net)}</b> },
          { key: "s", head: "Status", render: (s) => <SBadge s={s.status} /> },
          { key: "r", head: "Reference", render: (s) => <span style={muted}>{s.ref ?? "—"}</span> },
        ]} />
      </Panel>
      <Panel pad={false} title="Transactions & invoices · 30 days" actions={<Btn safe kind="ghost" small onClick={() => downloadCsv(`transactions-${vendorId}.csv`, done.map((o) => ({ order: o.id, date: fmtDT(o.createdAt), invoice: o.invoiceNo, method: o.payment.method, routing: o.payment.routing, gross: o.total, tax: o.tax, commission: commissionOf(v, o) })))}>Export CSV</Btn>}>
        <Table rows={done} rowKey={(o) => o.id} cols={[
          { key: "i", head: "Invoice", render: (o) => <div><b>{o.invoiceNo}</b><div style={muted}>#{o.id}</div></div> },
          { key: "d", head: "Date", render: (o) => fmtDT(o.createdAt) },
          { key: "m", head: "Method", render: (o) => <span>{o.payment.method} <span style={muted}>· {o.payment.routing}</span></span> },
          { key: "g", head: "Amount", align: "right", render: (o) => inr(o.total) },
          { key: "t", head: "GST", align: "right", render: (o) => inr(o.tax) },
          { key: "c", head: "Commission", align: "right", render: (o) => inr(commissionOf(v, o)) },
          { key: "s", head: "Payment", render: (o) => <SBadge s={o.payment.status} /> },
        ]} />
      </Panel>
    </div>
  );
}

const RANGES = { "7 days": 7, "30 days": 30 } as const;

export function VendorReports({ vendorId }: VProps) {
  const db = useData();
  const now = useNow(10000);
  const [range, setRange] = useState<keyof typeof RANGES>("30 days");
  const [sku, setSku] = useState("all");
  const days = RANGES[range];
  const all = inRange(vendorOrders(db.orders, vendorId), now - days * DAY).filter((o) => sku === "all" || o.items.some((i) => i.skuId === sku));
  const buckets = ["Delivered", "Cancelled", "Failed", "In progress", "Requested", "Accepted"].map((b) => ({ label: b, v: all.filter((o) => bucketStatus(o) === b).length })).filter((x) => x.v);
  const drivers = db.drivers.filter((d) => d.vendorId === vendorId);
  const rated = all.filter((o) => o.rating);
  const cancels = all.filter((o) => o.status === "Cancelled" || o.status === "Failed Assignment");
  const perf = drivers.map((d) => {
    const os = all.filter((o) => o.driverId === d.id);
    const done = os.filter(isDone);
    return { d, done: done.length, mins: Math.round(avg(done.map(deliveryMins).filter((x): x is number => x !== null))), rating: avg(done.filter((o) => o.rating).map((o) => o.rating!.driver)), cod: done.filter((o) => o.payment.method === "COD").reduce((s, o) => s + o.total, 0), acc: driverStats(db, d.id).acceptance };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Filter options={Object.keys(RANGES) as (keyof typeof RANGES)[]} value={range} onChange={setRange} />
        <select value={sku} onChange={(e) => setSku(e.target.value)} style={{ ...input, width: "auto" }} aria-label="Product">
          <option value="all">All products</option>{db.skus.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Btn safe kind="ghost" small onClick={() => downloadCsv(`orders-report-${vendorId}.csv`, all.map((o) => ({ order: o.id, date: fmtDT(o.createdAt), status: o.status, type: o.type, total: o.total, payment: o.payment.method, driver: db.drivers.find((d) => d.id === o.driverId)?.name ?? "", minutes: deliveryMins(o) ?? "", rating: o.rating?.vendor ?? "" })))}>Export orders CSV</Btn>
      </div>
      <div className="admin-grid-4">
        <Stat label="Orders" value={String(all.length)} />
        <Stat label="Sales (GMV)" value={inr(gmv(all))} tone="green" />
        <Stat label="Avg delivery time" value={`${Math.round(avg(all.map(deliveryMins).filter((x): x is number => x !== null)))} min`} tone="purple" />
        <Stat label="Avg rating" value={rated.length ? `★ ${avg(rated.map((o) => o.rating!.vendor)).toFixed(2)}` : "—"} sub={`product ★ ${avg(rated.map((o) => o.rating!.product)).toFixed(2)}`} tone="amber" />
      </div>
      <div className="admin-grid-2">
        <Panel title="Daily sales"><Bars data={daily(all, days, gmv, now)} fmt={inr} /></Panel>
        <Panel title="Orders by outcome"><Donut parts={buckets} center={String(all.length)} /></Panel>
      </div>
      <Panel pad={false} title="Driver performance" actions={<Btn safe kind="ghost" small onClick={() => downloadCsv(`drivers-${vendorId}.csv`, perf.map((p) => ({ driver: p.d.name, delivered: p.done, avg_minutes: p.mins, rating: p.rating.toFixed(2), acceptance_pct: p.acc, cod_collected: p.cod })))}>Export CSV</Btn>}>
        <Table rows={perf} rowKey={(p) => p.d.id} cols={[
          { key: "n", head: "Driver", render: (p) => <b>{p.d.name}</b> },
          { key: "c", head: "Delivered", align: "right", render: (p) => p.done },
          { key: "m", head: "Avg time", align: "right", render: (p) => (p.mins ? `${p.mins} min` : "—") },
          { key: "a", head: "Acceptance", align: "right", render: (p) => `${p.acc}%` },
          { key: "r", head: "Rating", align: "right", render: (p) => (p.rating ? `★ ${p.rating.toFixed(2)}` : "—") },
          { key: "cod", head: "COD collected", align: "right", render: (p) => inr(p.cod) },
        ]} />
      </Panel>
      <div className="admin-grid-even">
        <Panel pad={false} title={`Cancellations & failures (${cancels.length})`}>
          <Table rows={cancels} rowKey={(o) => o.id} pageSize={6} cols={[
            { key: "o", head: "Order", render: (o) => <b>#{o.id}</b> },
            { key: "s", head: "Status", render: (o) => <SBadge s={o.status} /> },
            { key: "r", head: "Reason", render: (o) => <span style={muted}>{o.cancel ? `${o.cancel.by}: ${o.cancel.reason}` : "No driver accepted"}</span> },
          ]} />
        </Panel>
        <Panel pad={false} title="Customer feedback">
          <Table rows={rated.filter((o) => o.rating!.comment || o.rating!.vendor < 4)} rowKey={(o) => o.id} pageSize={6} empty="No written feedback in this period." cols={[
            { key: "o", head: "Order", render: (o) => <b>#{o.id}</b> },
            { key: "r", head: "Vendor / water", render: (o) => `★${o.rating!.vendor} / ★${o.rating!.product}` },
            { key: "c", head: "Comment", render: (o) => <span style={muted}>{o.rating!.comment || o.rating!.tags.join(", ")}</span> },
          ]} />
        </Panel>
      </div>
    </div>
  );
}

export function VendorSettings({ vendorId, actor, toast }: VProps) {
  const db = useData();
  const v = db.vendors.find((x) => x.id === vendorId)!;
  const plan = db.vendorPlans.find((p) => p.id === v.planId);
  const [f, setF] = useState({ phone: v.phone, email: v.email, address: v.address, gstin: v.gstin ?? "", gstRate: v.gstRate });
  const gstOk = !f.gstin || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(f.gstin);

  const save = () => {
    if (!gstOk) { toast("GSTIN format looks wrong"); return; }
    update((d) => {
      const x = d.vendors.find((y) => y.id === vendorId)!;
      const changes = [x.gstin !== (f.gstin || null) ? `GSTIN ${x.gstin ?? "none"} → ${f.gstin || "none"}` : "", x.gstRate !== f.gstRate ? `GST ${x.gstRate}% → ${f.gstRate}%` : ""].filter(Boolean).join(", ");
      Object.assign(x, { phone: f.phone, email: f.email, address: f.address, gstin: f.gstin || null, gstRate: f.gstin ? f.gstRate : 0 });
      d.products.forEach((p) => { if (p.vendorId === vendorId && !x.gstin) p.taxable = false; });
      audit(d, actor.name, actor.role, "Business profile updated", v.name, changes || "Contact details");
    });
    toast("Settings saved");
  };

  return (
    <div className="admin-grid-even">
      <Panel title="Business profile & tax" actions={<Btn onClick={save}>Save</Btn>}>
        <KV k="Business name" v={v.name} />
        <KV k="Owner" v={v.owner} />
        <KV k="City" v={db.cities.find((c) => c.id === v.cityId)?.name} />
        <div style={{ height: 12 }} />
        <Field label="Phone"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} style={input} /></Field>
        <Field label="Email"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} style={input} /></Field>
        <Field label="Operating address"><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} style={input} /></Field>
        <div className="admin-grid-even" style={{ gap: 10 }}>
          <Field label="GSTIN" hint={gstOk ? "Leave empty if not registered — customers get receipts instead of tax invoices." : "Invalid GSTIN"}><input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase().slice(0, 15) })} style={input} /></Field>
          <Field label="GST rate"><select value={f.gstRate} disabled={!f.gstin} onChange={(e) => setF({ ...f, gstRate: Number(e.target.value) })} style={input}>{[0, 5, 12, 18].map((r) => <option key={r} value={r}>{r}%</option>)}</select></Field>
        </div>
      </Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="Platform subscription & commercials" actions={plan && <Btn kind="gold" small onClick={() => {
          update((d) => { const x = d.vendors.find((y) => y.id === vendorId)!; x.planExpiry = Math.max(x.planExpiry, Date.now()) + plan.days * DAY; audit(d, actor.name, actor.role, "Vendor plan renewed", v.name, `${plan.name} · ${inr(plan.fee)}`); notify(d, "admin", "Vendor plan renewed", `${v.name} renewed ${plan.name}.`); });
          toast(`${plan.name} renewed`);
        }}>Renew · {inr(plan.fee)}</Btn>}>
          <KV k="Model (set by platform)" v={v.monetization.mode === "both" ? "Subscription + commission" : v.monetization.mode === "commission" ? "Commission only" : "Subscription only"} />
          {plan && <KV k="Plan" v={`${plan.name} · ${inr(plan.fee)}/${plan.days} days`} />}
          {plan && <KV k="Valid till" v={<span>{fmtDate(v.planExpiry)} {v.planExpiry < Date.now() && <Badge tone="red">Expired</Badge>}</span>} />}
          {v.monetization.mode !== "subscription" && <KV k="Commission" v={`${v.monetization.commissionPct}% per completed delivery`} />}
          <KV k="Payment collection" v={v.paymentMode === "platform" ? "Platform collects, settles weekly" : "Direct to vendor"} />
          <KV k="If plan expires" v={db.settings.vendorExpiry} />
        </Panel>
        <Panel title="KYC & compliance documents">
          {v.docs.map((d, i) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ flex: 1, fontSize: 13 }}>{d.name}</span>
              <SBadge s={d.status} />
              {d.status !== "Verified" && <Btn kind="ghost" small onClick={() => { update((x) => { x.vendors.find((y) => y.id === vendorId)!.docs[i].status = "Pending"; notify(x, "admin", "Vendor document uploaded", `${v.name}: ${d.name}`); }); toast("Uploaded — awaiting review"); }}>Upload</Btn>}
            </div>
          ))}
          <p style={{ ...muted, marginTop: 8 }}>Required documents are configured by the platform. Account status: <SBadge s={v.status} /> · KYC <SBadge s={v.kyc} /></p>
        </Panel>
      </div>
    </div>
  );
}

