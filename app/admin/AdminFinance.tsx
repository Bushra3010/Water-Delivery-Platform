"use client";

import { useState } from "react";
import { audit, notify } from "../lib/actions";
import { DAY, commissionOf, downloadCsv, fmtDT, fmtDate, inr } from "../lib/logic";
import { update, useData, useNow } from "../lib/store";
import type { Coupon, Settings } from "../lib/types";
import { inRange, isDone } from "../web/analytics";
import { Badge, Btn, Field, Filter, KV, Modal, Panel, SBadge, SearchBox, Stat, Switch, Table, input, muted } from "../web/kit";
import { OrderModal } from "../web/OrderModal";
import type { AProps } from "./AdminApp";

/* ───────────────────────── Payments & wallet ───────────────────────── */

export function AdminPayments({ actor, toast, role }: AProps) {
  const db = useData();
  const now = useNow(10000);
  const [method, setMethod] = useState<"All" | "COD" | "UPI" | "Wallet" | "Subscription">("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const month = inRange(db.orders, now - 30 * DAY);
  const paid = month.filter(isDone);
  const online = paid.filter((o) => o.payment.method === "UPI" || o.payment.method === "Wallet");
  const refunds = db.orders.filter((o) => o.payment.status === "Refund Pending");
  const walletTotal = db.wallet.reduce((s, w) => s + w.amount, 0);
  const cust = (id: string) => db.customers.find((c) => c.id === id)?.name ?? "";
  const txns = month.filter((o) => (method === "All" || o.payment.method === method) && (!q || o.id.toLowerCase().includes(q.toLowerCase()) || (o.payment.ref ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat icon="📲" label="Online · platform collected" value={inr(online.filter((o) => o.payment.routing === "platform").reduce((s, o) => s + o.total, 0))} sub={`direct-to-vendor ${inr(online.filter((o) => o.payment.routing === "direct").reduce((s, o) => s + o.total, 0))}`} />
        <Stat icon="💵" label="COD collected · 30d" value={inr(paid.filter((o) => o.payment.method === "COD").reduce((s, o) => s + o.total, 0))} tone="green" />
        <Stat icon="👛" label="Wallet liability" value={inr(walletTotal)} sub={`${db.wallet.length} ledger entries`} tone="purple" />
        <Stat icon="↩️" label="Refunds pending" value={String(refunds.length)} sub={inr(refunds.reduce((s, o) => s + o.total - (o.cancel?.fee ?? 0), 0))} tone={refunds.length ? "red" : "grey"} />
      </div>
      <Panel pad={false} title={`Manual refund queue (${refunds.length})`} actions={<span style={muted}>Refunds are approved by an administrator and logged in the audit trail.</span>}>
        <Table rows={refunds} rowKey={(o) => o.id} onRow={(o) => setOpen(o.id)} empty="Nothing to refund 🎉" cols={[
          { key: "o", head: "Order", render: (o) => <b>#{o.id}</b> },
          { key: "c", head: "Customer", render: (o) => cust(o.customerId) },
          { key: "r", head: "Reason", render: (o) => <span style={muted}>{o.cancel ? o.cancel.reason : o.status}</span> },
          { key: "m", head: "Paid via", render: (o) => `${o.payment.method} · ${o.payment.ref ?? ""}` },
          { key: "a", head: "Refund", align: "right", render: (o) => <b>{inr(o.total - (o.cancel?.fee ?? 0))}</b> },
          { key: "x", head: "", align: "right", render: (o) => <Btn kind="go" small onClick={() => setOpen(o.id)}>Review</Btn> },
        ]} />
      </Panel>
      <Panel pad={false} title={<Filter options={["All", "COD", "UPI", "Wallet", "Subscription"] as const} value={method} onChange={setMethod} />} actions={<>
        <SearchBox value={q} onChange={setQ} placeholder="Order or payment ref" />
        <Btn safe kind="ghost" small onClick={() => downloadCsv("transactions.csv", txns.map((o) => ({ order: o.id, date: fmtDT(o.createdAt), customer: cust(o.customerId), vendor: db.vendors.find((v) => v.id === o.vendorId)?.name ?? "", method: o.payment.method, routing: o.payment.routing, ref: o.payment.ref ?? "", amount: o.total, tax: o.tax, status: o.payment.status })))}>Export</Btn>
      </>}>
        <Table rows={txns} rowKey={(o) => o.id} onRow={(o) => setOpen(o.id)} pageSize={10} cols={[
          { key: "o", head: "Order", render: (o) => <div><b>#{o.id}</b><div style={muted}>{fmtDT(o.createdAt)}</div></div> },
          { key: "c", head: "Customer", render: (o) => cust(o.customerId) },
          { key: "v", head: "Vendor", render: (o) => <span style={muted}>{db.vendors.find((v) => v.id === o.vendorId)?.name ?? "—"}</span> },
          { key: "m", head: "Method", render: (o) => <span>{o.payment.method} <span style={muted}>· {o.payment.routing}</span></span> },
          { key: "r", head: "Reference", render: (o) => <span style={muted}>{o.payment.ref ?? "—"}</span> },
          { key: "a", head: "Amount", align: "right", render: (o) => inr(o.total) },
          { key: "s", head: "Status", render: (o) => <SBadge s={o.payment.status} /> },
        ]} />
      </Panel>
      <Panel pad={false} title="Wallet ledger">
        <Table rows={[...db.wallet].sort((a, b) => b.at - a.at)} rowKey={(w) => w.id} pageSize={8} cols={[
          { key: "d", head: "When", render: (w) => fmtDT(w.at) },
          { key: "c", head: "Customer", render: (w) => cust(w.customerId) },
          { key: "t", head: "Entry", render: (w) => w.title },
          { key: "r", head: "Ref", render: (w) => <span style={muted}>{w.ref ?? "—"}</span> },
          { key: "a", head: "Amount", align: "right", render: (w) => <b style={{ color: w.amount > 0 ? "var(--success-text)" : undefined }}>{w.amount > 0 ? "+" : "−"}{inr(Math.abs(w.amount))}</b> },
        ]} />
      </Panel>
      {open && <OrderModal id={open} onClose={() => setOpen(null)} actor={actor} canRefund={!role.readOnly} toast={toast} />}
    </div>
  );
}

/* ───────────────────────── Settlements ───────────────────────── */

export function AdminSettlements({ actor, toast }: AProps) {
  const db = useData();
  const now = useNow(30000);
  const [f, setF] = useState<"All" | "Pending Review" | "Approved" | "Paid">("All");
  const [view, setView] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const rows = db.settlements.filter((s) => f === "All" || s.status === f).sort((a, b) => b.at - a.at);
  const from = now - 7 * DAY;
  const period = `${fmtDate(from).replace(/ \d{4}$/, "")} – ${fmtDate(now).replace(/ \d{4}$/, "")}`;

  const generate = () => {
    let n = 0;
    update((d) => {
      d.vendors.filter((v) => v.paymentMode === "platform" && v.status !== "Blocked").forEach((v) => {
        if (d.settlements.some((s) => s.vendorId === v.id && s.period === period)) return;
        const os = d.orders.filter((o) => o.vendorId === v.id && isDone(o) && o.createdAt >= from);
        if (!os.length) return;
        const gross = os.filter((o) => o.payment.method === "UPI" || o.payment.method === "Wallet").reduce((s, o) => s + o.total, 0);
        const commission = os.reduce((s, o) => s + commissionOf(v, o), 0);
        d.settlements.unshift({ id: `ST-${v.id.toUpperCase()}-${Date.now().toString().slice(-5)}${n}`, vendorId: v.id, period, orders: os.length, gross, commission, fee: 0, net: gross - commission, status: "Pending Review", approvedBy: null, at: Date.now(), ref: null });
        n++;
      });
      if (n) audit(d, actor.name, actor.role, "Settlements generated", period, `${n} vendor(s)`);
    });
    toast(n ? `${n} settlement(s) prepared for review` : "Nothing new to settle for this period");
  };
  const approve = (id: string) => { update((d) => { const s = d.settlements.find((x) => x.id === id)!; s.status = "Approved"; s.approvedBy = `${actor.name} (${actor.role})`; audit(d, actor.name, actor.role, "Settlement approved", id, `Net ${inr(s.net)}`); notify(d, `vendor:${s.vendorId}`, "Settlement approved", `${id} · ${inr(s.net)} will be paid shortly.`); }); toast("Settlement approved"); };
  const pay = (id: string) => {
    if (utr.trim().length < 6) { toast("Enter the bank transfer reference (UTR)"); return; }
    update((d) => { const s = d.settlements.find((x) => x.id === id)!; s.status = "Paid"; s.ref = utr.trim().toUpperCase(); audit(d, actor.name, actor.role, "Settlement paid", id, `UTR ${s.ref}`); notify(d, `vendor:${s.vendorId}`, "Settlement paid", `${inr(s.net)} sent · ref ${s.ref}`); });
    setUtr(""); setView(null); toast("Marked as paid");
  };
  const s = view ? db.settlements.find((x) => x.id === view) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat label="Pending review" value={String(db.settlements.filter((x) => x.status === "Pending Review").length)} sub={inr(db.settlements.filter((x) => x.status === "Pending Review").reduce((a, x) => a + x.net, 0))} tone="amber" />
        <Stat label="Approved, unpaid" value={String(db.settlements.filter((x) => x.status === "Approved").length)} sub={inr(db.settlements.filter((x) => x.status === "Approved").reduce((a, x) => a + x.net, 0))} tone="blue" />
        <Stat label="Paid (all time)" value={inr(db.settlements.filter((x) => x.status === "Paid").reduce((a, x) => a + x.net, 0))} tone="green" />
        <Stat label="Commission retained" value={inr(db.settlements.reduce((a, x) => a + x.commission, 0))} tone="purple" />
      </div>
      <Panel pad={false} title={<Filter options={["All", "Pending Review", "Approved", "Paid"] as const} value={f} onChange={setF} />} actions={<Btn onClick={generate}>Prepare settlements · last 7 days</Btn>}>
        <Table rows={rows} rowKey={(x) => x.id} onRow={(x) => setView(x.id)} cols={[
          { key: "id", head: "Settlement", render: (x) => <div><b>{x.id}</b><div style={muted}>{x.period}</div></div> },
          { key: "v", head: "Vendor", render: (x) => db.vendors.find((v) => v.id === x.vendorId)?.name },
          { key: "o", head: "Orders", align: "right", render: (x) => x.orders },
          { key: "g", head: "Online gross", align: "right", render: (x) => inr(x.gross) },
          { key: "c", head: "Commission", align: "right", render: (x) => inr(x.commission) },
          { key: "n", head: "Net payable", align: "right", render: (x) => <b>{inr(x.net)}</b> },
          { key: "s", head: "Status", render: (x) => <SBadge s={x.status} /> },
          { key: "a", head: "", align: "right", render: (x) => x.status === "Pending Review" ? <Btn kind="go" small onClick={() => approve(x.id)}>Approve</Btn> : x.status === "Approved" ? <Btn small onClick={() => setView(x.id)}>Mark paid</Btn> : <span style={muted}>{x.ref}</span> },
        ]} />
      </Panel>
      {s && (
        <Modal title={`Settlement ${s.id}`} onClose={() => setView(null)} footer={<>
          {s.status === "Pending Review" && <Btn kind="go" onClick={() => approve(s.id)}>Approve</Btn>}
          {s.status === "Approved" && <><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR / bank reference" style={{ ...input, width: 200 }} aria-label="UTR" /><Btn onClick={() => pay(s.id)}>Mark paid</Btn></>}
          <Btn safe kind="ghost" onClick={() => setView(null)}>Close</Btn>
        </>}>
          <KV k="Vendor" v={db.vendors.find((v) => v.id === s.vendorId)?.name} />
          <KV k="Period" v={s.period} />
          <KV k="Completed orders" v={s.orders} />
          <KV k="Online payments collected by platform" v={inr(s.gross)} />
          <KV k="Less: commission" v={`− ${inr(s.commission)}`} />
          <KV k="Less: fees" v={`− ${inr(s.fee)}`} />
          <KV k={<b>Net payable to vendor</b>} v={<b>{inr(s.net)}</b>} />
          <KV k="Status" v={<SBadge s={s.status} />} />
          {s.approvedBy && <KV k="Approved by" v={s.approvedBy} />}
          {s.ref && <KV k="Payment reference" v={s.ref} />}
          <p style={{ ...muted, marginTop: 10 }}>COD cash stays with the vendor; commission on COD orders is netted here. Settlement release always requires manual approval.</p>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────────── Coupons ───────────────────────── */

export function AdminCoupons({ actor, toast }: AProps) {
  const db = useData();
  const now = useNow(60000);
  const [edit, setEdit] = useState<Coupon | null>(null);
  const [isNew, setIsNew] = useState(false);
  const discounted = db.orders.filter((o) => o.coupon);
  const save = () => {
    if (!edit) return;
    if (!/^[A-Z0-9]{4,15}$/.test(edit.code)) { toast("Code: 4–15 letters/digits"); return; }
    if (isNew && db.coupons.some((c) => c.code === edit.code)) { toast("Code already exists"); return; }
    if (edit.value <= 0 || (edit.kind === "pct" && edit.value > 90)) { toast("Enter a valid discount"); return; }
    update((d) => { if (isNew) d.coupons.unshift(edit); else Object.assign(d.coupons.find((c) => c.code === edit.code)!, edit); audit(d, actor.name, actor.role, isNew ? "Coupon created" : "Coupon updated", edit.code, edit.desc); });
    setEdit(null); toast("Coupon saved");
  };
  return (
    <Panel pad={false} title={`${db.coupons.filter((c) => c.active && c.validTill > now).length} live coupons · ${discounted.length} orders used a coupon`} actions={<Btn onClick={() => { setIsNew(true); setEdit({ code: "", desc: "", kind: "flat", value: 50, maxOff: null, minOrder: 200, limit: 1000, used: 0, perUser: 1, active: true, validTill: now + 30 * DAY }); }}>+ New coupon</Btn>}>
      <Table rows={db.coupons} rowKey={(c) => c.code} cols={[
        { key: "c", head: "Code", render: (c) => <div><b style={{ letterSpacing: "0.05em" }}>{c.code}</b><div style={muted}>{c.desc}</div></div> },
        { key: "v", head: "Discount", render: (c) => (c.kind === "flat" ? inr(c.value) : `${c.value}%${c.maxOff ? ` (max ${inr(c.maxOff)})` : ""}`) },
        { key: "m", head: "Min order", render: (c) => inr(c.minOrder) },
        { key: "u", head: "Used / limit", render: (c) => `${c.used.toLocaleString("en-IN")} / ${c.limit.toLocaleString("en-IN")}` },
        { key: "p", head: "Per user", align: "right", render: (c) => c.perUser },
        { key: "t", head: "Valid till", render: (c) => <span style={{ color: c.validTill < now ? "var(--error-text)" : undefined }}>{fmtDate(c.validTill)}</span> },
        { key: "a", head: "Live", render: (c) => <Switch on={c.active} onChange={(x) => { update((d) => { d.coupons.find((y) => y.code === c.code)!.active = x; audit(d, actor.name, actor.role, x ? "Coupon resumed" : "Coupon paused", c.code, ""); }); toast(x ? "Coupon live" : "Coupon paused"); }} label="Active" /> },
        { key: "x", head: "", align: "right", render: (c) => <Btn kind="ghost" small onClick={() => { setIsNew(false); setEdit({ ...c }); }}>Edit</Btn> },
      ]} />
      {edit && (
        <Modal title={isNew ? "New coupon" : `Edit ${edit.code}`} onClose={() => setEdit(null)} footer={<><Btn safe kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
          <div className="admin-grid-even" style={{ gap: 10 }}>
            <Field label="Code"><input value={edit.code} disabled={!isNew} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/\s/g, "") })} style={input} /></Field>
            <Field label="Type"><select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Coupon["kind"] })} style={input}><option value="flat">Flat ₹ off</option><option value="pct">Percent off</option></select></Field>
            <Field label={edit.kind === "flat" ? "Amount (₹)" : "Percent"}><input value={edit.value} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            {edit.kind === "pct" && <Field label="Max discount (₹)"><input value={edit.maxOff ?? ""} onChange={(e) => setEdit({ ...edit, maxOff: Number(e.target.value.replace(/\D/g, "")) || null })} style={input} /></Field>}
            <Field label="Minimum order (₹)"><input value={edit.minOrder} onChange={(e) => setEdit({ ...edit, minOrder: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Total uses allowed"><input value={edit.limit} onChange={(e) => setEdit({ ...edit, limit: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Uses per customer"><input value={edit.perUser} onChange={(e) => setEdit({ ...edit, perUser: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Valid till"><input type="date" value={new Date(edit.validTill).toISOString().slice(0, 10)} onChange={(e) => setEdit({ ...edit, validTill: new Date(e.target.value).getTime() + DAY - 1 })} style={input} /></Field>
          </div>
          <Field label="Description shown to customers"><input value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} style={input} /></Field>
        </Modal>
      )}
    </Panel>
  );
}

/* ───────────────────────── Advertising ───────────────────────── */

export function AdminAds({ actor, toast }: AProps) {
  const db = useData();
  const a = db.settings.ads;
  const [unit, setUnit] = useState(a.unitId);
  const set = (patch: Partial<Settings["ads"]>, what: string) => { update((d) => { Object.assign(d.settings.ads, patch); audit(d, actor.name, actor.role, "Ad settings changed", "Google Mobile Ads", what); }); toast(what); };
  const rows: { key: keyof Settings["ads"]; label: string; where: string }[] = [
    { key: "homeBanner", label: "Home banner", where: "Customer Home, below products" },
    { key: "ordersNative", label: "Native ad in order history", where: "Orders list, after the 3rd order" },
    { key: "interstitial", label: "Interstitial after rating", where: "Shown once after a customer submits a rating" },
  ];
  return (
    <div className="admin-grid-2">
      <Panel title="Google Mobile Ads (AdMob) · customer Android app">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 14px", borderBottom: "1px solid var(--line)" }}>
          <div><b>Advertising enabled</b><p style={{ ...muted, margin: 0 }}>Master switch for every placement</p></div>
          <Switch on={a.enabled} onChange={(x) => set({ enabled: x }, x ? "Ads enabled" : "Ads disabled")} label="Ads enabled" />
        </div>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line)", opacity: a.enabled ? 1 : 0.5 }}>
            <div><b style={{ fontSize: 13.5 }}>{r.label}</b><p style={{ ...muted, margin: 0 }}>{r.where}</p></div>
            <Switch on={a[r.key] as boolean} onChange={(x) => set({ [r.key]: x } as Partial<Settings["ads"]>, `${r.label} ${x ? "on" : "off"}`)} label={r.label} />
          </div>
        ))}
        <Field label="Ad unit ID"><div style={{ display: "flex", gap: 6, marginTop: 12 }}><input value={unit} onChange={(e) => setUnit(e.target.value)} style={input} /><Btn disabled={unit === a.unitId} onClick={() => set({ unitId: unit.trim() }, "Ad unit saved")}>Save</Btn></div></Field>
      </Panel>
      <Panel title="Placement guardrails">
        {["Booking & checkout", "Payment (UPI sheet)", "Live tracking & OTP", "Support / emergency contact"].map((x) => <KV key={x} k={x} v={<Badge tone="red">Never shows ads</Badge>} />)}
        <p style={{ ...muted, marginTop: 12 }}>Placements above are enforced in the app code, not just here — admins can only turn ads on in safe places. Preview them live in the <a href="/customer" target="_blank">customer app</a>.</p>
      </Panel>
    </div>
  );
}
