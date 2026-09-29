"use client";

import { useState } from "react";
import CityMap, { type Area } from "../components/CityMap";
import { audit } from "../lib/actions";
import { DAY, downloadCsv, fmtDT, inr } from "../lib/logic";
import { resetDemo, update, useData, useNow } from "../lib/store";
import type { AdminSection, Settings } from "../lib/types";
import { bucketStatus, daily, gmv, inRange } from "../web/analytics";
import { Bars, Btn, Field, Panel, SBadge, SearchBox, Switch, Table, input, muted } from "../web/kit";
import type { AProps } from "./AdminApp";

export function AdminCities({ actor, toast }: AProps) {
  const db = useData();
  return (
    <div className="admin-grid-2">
      <Panel title="Coverage · Noida">
        <CityMap height={420} localities={db.localities.filter((l) => l.cityId === "noida")}
          areas={db.vendors.filter((v) => v.status === "Active").flatMap((v): Area[] => v.area.radiusKm ? [{ kind: "circle" as const, c: v.location, r: v.area.radiusKm * 100, color: "#0b5cff" }] : v.area.polygon ? [{ kind: "poly" as const, pts: v.area.polygon, color: "#16a34a" }] : [])}
          markers={db.vendors.map((v) => ({ id: v.id, pt: v.location, kind: "vendor" as const, label: v.name.split(" ")[0] }))} />
      </Panel>
      <Panel pad={false} title="City masters">
        <Table rows={db.cities} rowKey={(c) => c.id} cols={[
          { key: "n", head: "City", render: (c) => <b>{c.name}</b> },
          { key: "s", head: "State", render: (c) => c.state },
          { key: "l", head: "Zones", align: "right", render: (c) => db.localities.filter((l) => l.cityId === c.id).length },
          { key: "v", head: "Vendors", align: "right", render: (c) => db.vendors.filter((v) => v.cityId === c.id).length },
          { key: "a", head: "Live", render: (c) => <Switch on={c.active} onChange={(x) => { update((d) => { d.cities.find((y) => y.id === c.id)!.active = x; audit(d, actor.name, actor.role, x ? "City activated" : "City deactivated", c.name, ""); }); toast(`${c.name} ${x ? "live" : "off"}`); }} label="Live" /> },
        ]} />
      </Panel>
    </div>
  );
}

export function AdminReports(_: AProps) {
  const db = useData();
  const now = useNow(30000);
  const [days, setDays] = useState(30);
  const os = inRange(db.orders, now - days * DAY);
  const byVendor = db.vendors.map((v) => { const x = os.filter((o) => o.vendorId === v.id); return { vendor: v.name, orders: x.length, gmv: gmv(x), cancelled: x.filter((o) => o.status === "Cancelled").length }; });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="GMV per day" actions={<>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ ...input, width: "auto" }} aria-label="Range"><option value={7}>7 days</option><option value={30}>30 days</option></select>
        <Btn safe kind="ghost" small onClick={() => downloadCsv("orders-report.csv", os.map((o) => ({ order: o.id, date: fmtDT(o.createdAt), status: o.status, bucket: bucketStatus(o), total: o.total, payment: o.payment.method, vendor: db.vendors.find((v) => v.id === o.vendorId)?.name ?? "" })))}>Export orders</Btn>
        <Btn safe kind="ghost" small onClick={() => downloadCsv("vendor-report.csv", byVendor)}>Export vendors</Btn>
      </>}><Bars data={daily(os, days, gmv, now)} fmt={inr} /></Panel>
      <Panel pad={false} title="Vendor performance">
        <Table rows={byVendor} rowKey={(r) => r.vendor} cols={[
          { key: "v", head: "Vendor", render: (r) => <b>{r.vendor}</b> },
          { key: "o", head: "Orders", align: "right", render: (r) => r.orders },
          { key: "g", head: "GMV", align: "right", render: (r) => inr(r.gmv) },
          { key: "c", head: "Cancelled", align: "right", render: (r) => r.cancelled },
        ]} />
      </Panel>
    </div>
  );
}

const ALL: AdminSection[] = ["dashboard", "vendors", "customers", "drivers", "orders", "pricing", "monetization", "plans", "payments", "settlements", "coupons", "ads", "cities", "reports", "rbac", "audit", "settings"];

export function AdminRbac({ actor, toast }: AProps) {
  const db = useData();
  const toggle = (roleId: string, s: AdminSection) => {
    if (roleId === "super") { toast("Super Admin always has full access"); return; }
    update((d) => { const r = d.roles.find((x) => x.id === roleId)!; r.sections = r.sections.includes(s) ? r.sections.filter((x) => x !== s) : [...r.sections, s]; audit(d, actor.name, actor.role, "Permission changed", r.name, s); });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel pad={false} title="Permission matrix">
        <Table pageSize={20} rows={ALL} rowKey={(s) => s} cols={[{ key: "s", head: "Section", render: (s) => <b>{s}</b> }, ...db.roles.map((r) => ({ key: r.id, head: r.name, align: "center" as const, render: (s: AdminSection) => <input type="checkbox" aria-label={`${r.name} ${s}`} checked={r.sections.includes(s)} onChange={() => toggle(r.id, s)} /> }))]} />
      </Panel>
      <Panel pad={false} title="Staff">
        <Table rows={db.staff} rowKey={(s) => s.id} cols={[
          { key: "n", head: "Name", render: (s) => <div><b>{s.name}</b><div style={muted}>{s.email}</div></div> },
          { key: "r", head: "Role", render: (s) => db.roles.find((r) => r.id === s.roleId)?.name },
          { key: "a", head: "Active", render: (s) => <Switch on={s.active} onChange={(x) => { update((d) => { d.staff.find((y) => y.id === s.id)!.active = x; audit(d, actor.name, actor.role, "Staff access changed", s.name, x ? "enabled" : "disabled"); }); toast("Saved"); }} label="Active" /> },
        ]} />
      </Panel>
    </div>
  );
}

export function AdminAudit(_: AProps) {
  const db = useData();
  const [q, setQ] = useState("");
  const rows = db.audit.filter((a) => !q || `${a.actor} ${a.action} ${a.target} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel pad={false} title={`${db.audit.length} entries`} actions={<><SearchBox value={q} onChange={setQ} placeholder="Search audit log" /><Btn safe kind="ghost" small onClick={() => downloadCsv("audit.csv", rows.map((a) => ({ at: fmtDT(a.at), actor: a.actor, role: a.role, action: a.action, target: a.target, detail: a.detail })))}>Export</Btn></>}>
      <Table rows={rows} rowKey={(a) => a.id} pageSize={15} cols={[
        { key: "t", head: "When", render: (a) => fmtDT(a.at) },
        { key: "u", head: "Who", render: (a) => <div>{a.actor}<div style={muted}>{a.role}</div></div> },
        { key: "a", head: "Action", render: (a) => <b>{a.action}</b> },
        { key: "g", head: "Target", render: (a) => a.target },
        { key: "d", head: "Detail", render: (a) => <span style={muted}>{a.detail}</span> },
      ]} />
    </Panel>
  );
}

export function AdminSettings({ actor, toast }: AProps) {
  const db = useData();
  const [s, setS] = useState<Settings>(structuredClone(db.settings));
  const num = (k: keyof Settings) => <input value={String(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value.replace(/\D/g, "")) })} style={input} />;
  return (
    <div className="admin-grid-even">
      <Panel title="Dispatch, cancellation & fees" actions={<Btn onClick={() => { update((d) => { d.settings = s; audit(d, actor.name, actor.role, "Settings changed", "System", "Saved"); }); toast("Settings saved"); }}>Save all</Btn>}>
        <Field label="Driver response timeout (s)">{num("dispatchTimeoutSec")}</Field>
        <Field label="Max drivers tried per round">{num("maxAttempts")}</Field>
        <Field label="Search radius (km)">{num("searchRadiusKm")}</Field>
        <Field label="Free cancellation until"><select value={s.freeCancelUntil} onChange={(e) => setS({ ...s, freeCancelUntil: e.target.value as Settings["freeCancelUntil"] })} style={input}><option>Searching</option><option>Accepted</option><option>Out for Delivery</option></select></Field>
        <Field label="Cancellation fee (₹)">{num("cancelFee")}</Field>
        <Field label="Delivery fee (₹)">{num("deliveryFee")}</Field>
        <Field label="Can deposit (₹)">{num("canDeposit")}</Field>
        <Field label="When a vendor's plan expires"><select value={s.vendorExpiry} onChange={(e) => setS({ ...s, vendorExpiry: e.target.value as Settings["vendorExpiry"] })} style={input}><option>Stop new orders</option><option>Grace period (7 days)</option><option>Allow orders</option></select></Field>
      </Panel>
      <Panel title="Payments, languages & demo">
        {(["cod", "upi", "wallet"] as const).map((k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>{k.toUpperCase()}</span><Switch on={s.payModes[k]} onChange={(x) => setS({ ...s, payModes: { ...s.payModes, [k]: x } })} label={k} /></div>)}
        {s.languages.map((l, i) => <div key={l.code} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>{l.name}</span><Switch on={l.enabled} onChange={(x) => setS({ ...s, languages: s.languages.map((y, j) => (j === i ? { ...y, enabled: x || y.code === "en" } : y)) })} label={l.name} /></div>)}
        <div style={{ marginTop: 16 }}><SBadge s="Active" /> <Btn kind="danger" small onClick={() => { resetDemo(); toast("Demo data reset"); }}>Reset all demo data</Btn></div>
      </Panel>
    </div>
  );
}
