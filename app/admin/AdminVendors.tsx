"use client";

import { useState } from "react";
import CityMap, { type Area } from "../components/CityMap";
import { audit, notify } from "../lib/actions";
import { DAY, commissionOf, fmtDate, inr, vendorBlockers } from "../lib/logic";
import { update, useData, useNow } from "../lib/store";
import type { AccountStatus, KycStatus, Plan, Vendor, VendorPlan } from "../lib/types";
import { avg, gmv, inRange, isDone } from "../web/analytics";
import { Badge, Btn, Field, Filter, KV, Modal, Panel, SBadge, SearchBox, Stat, Switch, Table, input, muted } from "../web/kit";
import type { AProps } from "./AdminApp";

/* ───────────────────────── Vendors ───────────────────────── */

const VF = ["All", "Active", "Pending", "Suspended / blocked", "Plan expired"] as const;

export function AdminVendors({ actor, toast }: AProps) {
  const db = useData();
  const now = useNow(30000);
  const [f, setF] = useState<(typeof VF)[number]>("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const expired = (v: Vendor) => v.monetization.mode !== "commission" && v.planExpiry < now;
  const rows = db.vendors.filter((v) => (f === "All" || (f === "Active" && v.status === "Active") || (f === "Pending" && (v.status === "Pending" || v.kyc === "Pending")) || (f === "Suspended / blocked" && ["Suspended", "Blocked", "Inactive"].includes(v.status)) || (f === "Plan expired" && expired(v)))
    && (!q || v.name.toLowerCase().includes(q.toLowerCase()) || v.owner.toLowerCase().includes(q.toLowerCase())));
  const month = inRange(db.orders, now - 30 * DAY);

  return (
    <>
      <Panel pad={false} title={<Filter options={VF} value={f} onChange={setF} />} actions={<><SearchBox value={q} onChange={setQ} placeholder="Vendor or owner" /><Btn onClick={() => setCreating(true)}>+ Create vendor</Btn></>}>
        <Table rows={rows} rowKey={(v) => v.id} onRow={(v) => setView(v.id)} cols={[
          { key: "n", head: "Vendor", render: (v) => <div><b>{v.name}</b><div style={muted}>{v.owner} · {db.cities.find((c) => c.id === v.cityId)?.name}</div></div> },
          { key: "s", head: "Status", render: (v) => <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><SBadge s={v.status} /><SBadge s={v.kyc} /></div> },
          { key: "m", head: "Model", render: (v) => <span style={muted}>{v.monetization.mode === "both" ? `Plan + ${v.monetization.commissionPct}%` : v.monetization.mode === "commission" ? `${v.monetization.commissionPct}% commission` : "Plan only"} · {v.paymentMode}</span> },
          { key: "p", head: "Plan expiry", render: (v) => v.monetization.mode === "commission" ? <span style={muted}>n/a</span> : <span style={{ color: expired(v) ? "var(--error-text)" : undefined, fontWeight: expired(v) ? 700 : 400 }}>{fmtDate(v.planExpiry)}</span> },
          { key: "d", head: "Drivers", align: "right", render: (v) => db.drivers.filter((d) => d.vendorId === v.id).length },
          { key: "o", head: "GMV 30d", align: "right", render: (v) => inr(gmv(month.filter((o) => o.vendorId === v.id))) },
          { key: "e", head: "Receiving orders", render: (v) => { const b = vendorBlockers(db, v, now); return b.length ? <Badge tone="red">No — {b[0]}</Badge> : <Badge tone="green">Yes</Badge>; } },
        ]} />
      </Panel>
      {view && <VendorDetail id={view} onClose={() => setView(null)} actor={actor} toast={toast} />}
      {creating && <CreateVendor onClose={() => setCreating(false)} actor={actor} toast={toast} />}
    </>
  );
}

function VendorDetail({ id, onClose, actor, toast }: { id: string; onClose: () => void; actor: AProps["actor"]; toast: (m: string) => void }) {
  const db = useData();
  const now = useNow(30000);
  const v = db.vendors.find((x) => x.id === id)!;
  const [status, setStatus] = useState<AccountStatus>(v.status);
  const [reason, setReason] = useState("");
  const os = db.orders.filter((o) => o.vendorId === id);
  const done = os.filter(isDone);
  const areas: Area[] = [];
  if (v.area.radiusKm) areas.push({ kind: "circle", c: v.location, r: v.area.radiusKm * 100, color: "#0b5cff" });
  if (v.area.polygon) areas.push({ kind: "poly", pts: v.area.polygon, color: "#16a34a" });
  const mut = (action: string, detail: string, fn: (x: Vendor) => void) => {
    update((d) => { fn(d.vendors.find((y) => y.id === id)!); audit(d, actor.name, actor.role, action, v.name, detail); notify(d, `vendor:${id}`, action, detail); });
    toast(action);
  };
  const setDoc = (i: number, s: KycStatus) => mut("KYC document reviewed", `${v.docs[i].name}: ${s}`, (x) => { x.docs[i].status = s; });

  return (
    <Modal wide title={v.name} onClose={onClose} footer={<Btn safe kind="ghost" onClick={onClose}>Close</Btn>}>
      <div className="admin-grid-even">
        <div>
          <KV k="Owner / contact" v={`${v.owner} · ${v.phone}`} />
          <KV k="Email" v={v.email} />
          <KV k="Address" v={v.address} />
          <KV k="GSTIN" v={v.gstin ? `${v.gstin} (${v.gstRate}%)` : "Not registered"} />
          <KV k="Joined" v={fmtDate(v.joinedAt)} />
          <KV k="Orders delivered / rating" v={`${done.length} · ★ ${avg(done.filter((o) => o.rating).map((o) => o.rating!.vendor)).toFixed(2)}`} />
          <KV k="Eligible for dispatch" v={vendorBlockers(db, v, now).join(", ") || "Yes"} />

          <p style={{ margin: "16px 0 6px", fontSize: 13, fontWeight: 700 }}>Account status</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <select value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)} style={{ ...input, width: "auto" }} aria-label="Status">{(["Active", "Pending", "Inactive", "Suspended", "Blocked"] as const).map((s) => <option key={s}>{s}</option>)}</select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (audit log)" style={{ ...input, flex: 1, minWidth: 140 }} aria-label="Reason" />
            <Btn disabled={status === v.status || reason.trim().length < 3} onClick={() => { mut("Vendor status changed", `${v.status} → ${status}: ${reason.trim()}`, (x) => { x.status = status; }); setReason(""); }}>Apply</Btn>
          </div>

          <p style={{ margin: "16px 0 6px", fontSize: 13, fontWeight: 700 }}>KYC & compliance</p>
          {v.docs.map((d, i) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ flex: 1 }}>{d.name}</span><SBadge s={d.status} />
              {d.status === "Pending" && <><Btn kind="go" small onClick={() => setDoc(i, "Verified")}>Verify</Btn><Btn kind="danger" small onClick={() => setDoc(i, "Rejected")}>Reject</Btn></>}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>Overall KYC:</span> <SBadge s={v.kyc} />
            {v.kyc !== "Verified" && <Btn kind="go" small disabled={v.docs.some((d) => d.status !== "Verified")} onClick={() => mut("Vendor approved", "KYC verified and account activated", (x) => { x.kyc = "Verified"; if (x.status === "Pending") x.status = "Active"; })}>Approve vendor</Btn>}
            {v.kyc !== "Rejected" && <Btn kind="danger" small onClick={() => mut("Vendor KYC rejected", "KYC rejected", (x) => { x.kyc = "Rejected"; })}>Reject</Btn>}
          </div>
        </div>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>Commercials</p>
          <Field label="Monetization model">
            <select value={v.monetization.mode} onChange={(e) => mut("Monetization changed", `Model → ${e.target.value}`, (x) => { x.monetization.mode = e.target.value as Vendor["monetization"]["mode"]; })} style={input}>
              <option value="subscription">Subscription only</option><option value="commission">Commission only</option><option value="both">Subscription + commission</option>
            </select>
          </Field>
          {v.monetization.mode !== "subscription" && (
            <Field label="Commission per completed delivery (%)">
              <select value={v.monetization.commissionPct} onChange={(e) => mut("Commission changed", `${v.monetization.commissionPct}% → ${e.target.value}%`, (x) => { x.monetization.commissionPct = Number(e.target.value); })} style={input}>
                {[0, 3, 5, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}%</option>)}
              </select>
            </Field>
          )}
          {v.monetization.mode !== "commission" && (
            <Field label={`Vendor plan · expires ${fmtDate(v.planExpiry)}`}>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={v.planId ?? ""} onChange={(e) => mut("Vendor plan assigned", db.vendorPlans.find((p) => p.id === e.target.value)?.name ?? "none", (x) => { x.planId = e.target.value || null; })} style={input}>
                  <option value="">No plan</option>{db.vendorPlans.map((p) => <option key={p.id} value={p.id}>{p.name} · {inr(p.fee)}/{p.days}d</option>)}
                </select>
                <Btn kind="ghost" onClick={() => mut("Vendor plan extended", "+30 days", (x) => { x.planExpiry = Math.max(x.planExpiry, Date.now()) + 30 * DAY; })}>+30 days</Btn>
              </div>
            </Field>
          )}
          <Field label="Online payment collection">
            <select value={v.paymentMode} onChange={(e) => mut("Payment routing changed", `→ ${e.target.value}`, (x) => { x.paymentMode = e.target.value as Vendor["paymentMode"]; })} style={input}>
              <option value="platform">Platform collects, settles to vendor after approval</option><option value="direct">Direct to vendor (platform records commission)</option>
            </select>
          </Field>
          <p style={{ margin: "10px 0 6px", fontSize: 13, fontWeight: 700 }}>Service area</p>
          <CityMap height={200} fit={[v.location]} areas={areas} localities={db.localities.filter((l) => l.cityId === v.cityId)} markers={[{ id: v.id, pt: v.location, kind: "vendor" }, ...db.localities.filter((l) => v.area.localities.includes(l.id)).map((l) => ({ id: l.id, pt: l.center, kind: "approx" as const }))]} />
          <p style={{ ...muted, marginTop: 6 }}>Rule: {v.area.rule} · radius {v.area.radiusKm ?? "off"} · PINs {v.area.pins.join(", ") || "—"} · {v.area.localities.length} localities · geofence {v.area.polygon ? "on" : "off"}</p>
        </div>
      </div>
    </Modal>
  );
}

function CreateVendor({ onClose, actor, toast }: { onClose: () => void; actor: AProps["actor"]; toast: (m: string) => void }) {
  const db = useData();
  const cities = db.cities;
  const [f, setF] = useState({ name: "", owner: "", phone: "", email: "", cityId: "noida", localityId: "l22", planId: "vp1", mode: "both" as Vendor["monetization"]["mode"], pct: 5, pay: db.settings.defaultRouting });
  const locs = db.localities.filter((l) => l.cityId === f.cityId);
  const save = () => {
    if (f.name.trim().length < 3 || f.owner.trim().length < 3 || !/^[6-9]\d{9}$/.test(f.phone) || !/^\S+@\S+\.\S+$/.test(f.email)) { toast("Fill name, owner, valid mobile and email"); return; }
    if (db.vendors.some((v) => v.email === f.email.toLowerCase())) { toast("A vendor with this email exists"); return; }
    const loc = locs.find((l) => l.id === f.localityId) ?? locs[0];
    update((d) => {
      d.vendors.push({
        id: `v${Date.now()}`, name: f.name.trim(), owner: f.owner.trim(), phone: f.phone, email: f.email.toLowerCase(), cityId: f.cityId, address: loc ? `${loc.name}, ${cities.find((c) => c.id === f.cityId)?.name}` : "",
        location: loc ? { ...loc.center } : { x: 500, y: 500 }, status: "Pending", kyc: "Pending",
        docs: ["GST certificate", "FSSAI licence", "Owner PAN", "Water quality report"].map((name) => ({ name, status: "Missing" as const })),
        gstin: null, gstRate: 0, planId: f.mode === "commission" ? null : f.planId, planExpiry: Date.now() + 30 * DAY,
        monetization: { mode: f.mode, commissionPct: f.mode === "subscription" ? 0 : f.pct }, paymentMode: f.pay,
        area: { rule: "any", radiusKm: 2, pins: [], localities: [], polygon: null }, joinedAt: Date.now(),
      });
      audit(d, actor.name, actor.role, "Vendor created", f.name.trim(), `Pending KYC · ${f.mode}`);
    });
    onClose(); toast("Vendor created — login: their email / demo@123");
  };
  return (
    <Modal title="Create vendor" onClose={onClose} footer={<><Btn safe kind="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}>Create</Btn></>}>
      <div className="admin-grid-even" style={{ gap: 10 }}>
        <Field label="Business name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={input} /></Field>
        <Field label="Owner name"><input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} style={input} /></Field>
        <Field label="Mobile"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} style={input} /></Field>
        <Field label="Login email"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} style={input} /></Field>
        <Field label="City"><select value={f.cityId} onChange={(e) => setF({ ...f, cityId: e.target.value, localityId: db.localities.find((l) => l.cityId === e.target.value)?.id ?? "" })} style={input}>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (not live)"}</option>)}</select></Field>
        <Field label="Base locality"><select value={f.localityId} onChange={(e) => setF({ ...f, localityId: e.target.value })} style={input}>{locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        <Field label="Monetization"><select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as Vendor["monetization"]["mode"] })} style={input}><option value="both">Subscription + commission</option><option value="subscription">Subscription only</option><option value="commission">Commission only</option></select></Field>
        {f.mode !== "commission" && <Field label="Vendor plan"><select value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })} style={input}>{db.vendorPlans.map((p) => <option key={p.id} value={p.id}>{p.name} · {inr(p.fee)}</option>)}</select></Field>}
        {f.mode !== "subscription" && <Field label="Commission %"><input value={f.pct} onChange={(e) => setF({ ...f, pct: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>}
        <Field label="Payment collection"><select value={f.pay} onChange={(e) => setF({ ...f, pay: e.target.value as Vendor["paymentMode"] })} style={input}><option value="platform">Platform collection</option><option value="direct">Direct to vendor</option></select></Field>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Pricing controls ───────────────────────── */

export function AdminPricing({ actor, toast }: AProps) {
  const db = useData();
  const [draft, setDraft] = useState<Record<string, { min: string; max: string }>>({});
  const listed = (skuId: string) => db.products.filter((p) => p.skuId === skuId);
  const save = (skuId: string) => {
    const d = draft[skuId]; const min = Number(d.min), max = Number(d.max);
    if (!min || !max || min >= max) { toast("Minimum must be below maximum"); return; }
    const r = db.priceRules.find((x) => x.skuId === skuId)!;
    update((x) => { const y = x.priceRules.find((z) => z.skuId === skuId)!; y.min = min; y.max = max; audit(x, actor.name, actor.role, "Pricing rule changed", db.skus.find((s) => s.id === skuId)!.name, `${inr(r.min)}–${inr(r.max)} → ${inr(min)}–${inr(max)}`); });
    setDraft((x) => { const c = { ...x }; delete c[skuId]; return c; });
    toast("Price range saved");
  };
  const clamp = (skuId: string) => {
    const r = db.priceRules.find((x) => x.skuId === skuId)!;
    update((x) => {
      x.products.filter((p) => p.skuId === skuId && (p.price < r.min || p.price > r.max)).forEach((p) => {
        const n = Math.min(r.max, Math.max(r.min, p.price));
        p.history.push({ at: Date.now(), price: n, by: `${actor.name} (platform)` });
        notify(x, `vendor:${p.vendorId}`, "Price adjusted by platform", `${db.skus.find((s) => s.id === skuId)!.name}: ${inr(p.price)} → ${inr(n)} to fit the allowed range.`);
        p.price = n;
      });
      audit(x, actor.name, actor.role, "Vendor prices clamped", db.skus.find((s) => s.id === skuId)!.name, `Into ${inr(r.min)}–${inr(r.max)}`);
    });
    toast("Out-of-range prices adjusted");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel pad={false} title="Allowed selling-price range per product" actions={<span style={muted}>Vendors set their own price inside this range.</span>}>
        <Table rows={db.skus} rowKey={(s) => s.id} cols={[
          { key: "n", head: "Product", render: (s) => <div><b>{s.name}</b><div style={muted}>{s.size}{s.returnable ? " · reusable can" : ""}</div></div> },
          { key: "r", head: "Min – max (₹)", render: (s) => { const r = db.priceRules.find((x) => x.skuId === s.id)!; const d = draft[s.id] ?? { min: String(r.min), max: String(r.max) }; return (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input aria-label="Min" value={d.min} onChange={(e) => setDraft((x) => ({ ...x, [s.id]: { ...d, min: e.target.value.replace(/\D/g, "") } }))} style={{ ...input, width: 70, padding: "6px 8px" }} /> –
              <input aria-label="Max" value={d.max} onChange={(e) => setDraft((x) => ({ ...x, [s.id]: { ...d, max: e.target.value.replace(/\D/g, "") } }))} style={{ ...input, width: 70, padding: "6px 8px" }} />
              {draft[s.id] && <Btn small onClick={() => save(s.id)}>Save</Btn>}
            </div>
          ); } },
          { key: "v", head: "Vendors listing", align: "right", render: (s) => listed(s.id).length },
          { key: "p", head: "Vendor prices", render: (s) => { const ps = listed(s.id).map((p) => p.price); return ps.length ? `${inr(Math.min(...ps))} – ${inr(Math.max(...ps))}` : "—"; } },
          { key: "o", head: "Out of range", render: (s) => { const r = db.priceRules.find((x) => x.skuId === s.id)!; const n = listed(s.id).filter((p) => p.price < r.min || p.price > r.max).length; return n ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}><Badge tone="red">{n}</Badge><Btn kind="ghost" small onClick={() => clamp(s.id)}>Clamp</Btn></div> : <Badge tone="green">0</Badge>; } },
        ]} />
      </Panel>
      <Panel pad={false} title="Vendor price book">
        <Table rows={db.products} rowKey={(p) => p.id} pageSize={12} cols={[
          { key: "v", head: "Vendor", render: (p) => db.vendors.find((v) => v.id === p.vendorId)?.name },
          { key: "s", head: "Product", render: (p) => db.skus.find((s) => s.id === p.skuId)?.name },
          { key: "p", head: "Price", align: "right", render: (p) => inr(p.price) },
          { key: "c", head: "Last change", render: (p) => <span style={muted}>{fmtDate(p.history[p.history.length - 1]?.at ?? 0)} · {p.history[p.history.length - 1]?.by}</span> },
          { key: "st", head: "State", render: (p) => <span>{p.active ? <Badge tone="green">Listed</Badge> : <Badge tone="grey">Hidden</Badge>} {!p.inStock && <Badge tone="amber">Out of stock</Badge>}</span> },
        ]} />
      </Panel>
    </div>
  );
}

/* ───────────────────────── Vendor monetization ───────────────────────── */

export function AdminMonetization({ actor, toast }: AProps) {
  const db = useData();
  const now = useNow(30000);
  const [edit, setEdit] = useState<VendorPlan | null>(null);
  const month = inRange(db.orders, now - 30 * DAY).filter(isDone);
  const commission = month.reduce((s, o) => { const v = db.vendors.find((x) => x.id === o.vendorId); return s + (v ? commissionOf(v, o) : 0); }, 0);
  const subsRev = db.vendors.filter((v) => v.monetization.mode !== "commission" && v.planExpiry > now).reduce((s, v) => s + (db.vendorPlans.find((p) => p.id === v.planId)?.fee ?? 0), 0);
  const custSubs = db.subs.filter((s) => s.start > now - 30 * DAY).reduce((s, x) => s + (db.plans.find((p) => p.id === x.planId)?.price ?? 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat icon="🏷️" label="Commission · 30d" value={inr(commission)} tone="blue" />
        <Stat icon="📅" label="Vendor subscriptions (MRR)" value={inr(subsRev)} tone="green" />
        <Stat icon="🔁" label="Customer plan sales · 30d" value={inr(custSubs)} tone="purple" />
        <Stat icon="📢" label="Ad placements" value={db.settings.ads.enabled ? [db.settings.ads.homeBanner, db.settings.ads.ordersNative, db.settings.ads.interstitial].filter(Boolean).length + " live" : "Off"} tone="amber" />
      </div>
      <Panel pad={false} title="Vendor subscription plans" actions={<Btn onClick={() => setEdit({ id: "", name: "", fee: 0, days: 30, perks: "" })}>+ New plan</Btn>}>
        <Table rows={db.vendorPlans} rowKey={(p) => p.id} cols={[
          { key: "n", head: "Plan", render: (p) => <b>{p.name}</b> },
          { key: "f", head: "Fee", render: (p) => `${inr(p.fee)} / ${p.days} days` },
          { key: "p", head: "Includes", render: (p) => <span style={muted}>{p.perks}</span> },
          { key: "v", head: "Vendors", align: "right", render: (p) => db.vendors.filter((v) => v.planId === p.id && v.monetization.mode !== "commission").length },
          { key: "x", head: "", align: "right", render: (p) => <Btn kind="ghost" small onClick={() => setEdit({ ...p })}>Edit</Btn> },
        ]} />
      </Panel>
      <Panel pad={false} title="Model per vendor" actions={<span style={muted}>Open a vendor in Vendor Management to change its model.</span>}>
        <Table rows={db.vendors} rowKey={(v) => v.id} cols={[
          { key: "n", head: "Vendor", render: (v) => <b>{v.name}</b> },
          { key: "m", head: "Model", render: (v) => v.monetization.mode },
          { key: "c", head: "Commission", render: (v) => (v.monetization.mode === "subscription" ? "—" : `${v.monetization.commissionPct}%`) },
          { key: "p", head: "Plan", render: (v) => (v.monetization.mode === "commission" ? "—" : `${db.vendorPlans.find((p) => p.id === v.planId)?.name ?? "None"} · till ${fmtDate(v.planExpiry)}`) },
          { key: "r", head: "Commission 30d", align: "right", render: (v) => inr(month.filter((o) => o.vendorId === v.id).reduce((s, o) => s + commissionOf(v, o), 0)) },
        ]} />
      </Panel>
      {edit && (
        <Modal title={edit.id ? "Edit vendor plan" : "New vendor plan"} onClose={() => setEdit(null)} footer={<><Btn safe kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={() => {
          if (!edit.name.trim() || edit.fee <= 0) { toast("Enter a name and fee"); return; }
          update((d) => { if (edit.id) Object.assign(d.vendorPlans.find((p) => p.id === edit.id)!, edit); else d.vendorPlans.push({ ...edit, id: `vp${Date.now()}` }); audit(d, actor.name, actor.role, "Vendor plan saved", edit.name, `${inr(edit.fee)}/${edit.days}d`); });
          setEdit(null); toast("Plan saved");
        }}>Save</Btn></>}>
          <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={input} /></Field>
          <Field label="Fee (₹)"><input value={edit.fee || ""} onChange={(e) => setEdit({ ...edit, fee: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
          <Field label="Billing period (days)"><input value={edit.days} onChange={(e) => setEdit({ ...edit, days: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
          <Field label="What's included"><input value={edit.perks} onChange={(e) => setEdit({ ...edit, perks: e.target.value })} style={input} /></Field>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────────── Customer plans ───────────────────────── */

export function AdminPlans({ actor, toast }: AProps) {
  const db = useData();
  const [owner, setOwner] = useState<"All" | "Platform" | "Vendor">("All");
  const [edit, setEdit] = useState<Plan | null>(null);
  const rows = db.plans.filter((p) => owner === "All" || (owner === "Platform") === (p.owner === "platform"));
  const subs = (id: string) => db.subs.filter((s) => s.planId === id);
  const save = () => {
    if (!edit) return;
    if (!edit.name.trim() || edit.price <= 0 || edit.entitlement < 1) { toast("Fill in name, price and entitlement"); return; }
    update((d) => { if (edit.id) Object.assign(d.plans.find((p) => p.id === edit.id)!, edit); else d.plans.push({ ...edit, id: `pl${Date.now()}` }); audit(d, actor.name, actor.role, edit.id ? "Platform plan updated" : "Platform plan created", edit.name, `${inr(edit.price)} · ${edit.entitlement} units`); });
    setEdit(null); toast("Plan saved");
  };
  return (
    <Panel pad={false} title={<Filter options={["All", "Platform", "Vendor"] as const} value={owner} onChange={setOwner} />} actions={<Btn onClick={() => setEdit({ id: "", owner: "platform", name: "", desc: "", skuId: "s20", price: 0, validityDays: 30, entitlement: 4, mode: "Both", maxPerDay: 2, unused: "Carry forward", autoRenew: true, active: true })}>+ Platform plan</Btn>}>
      <Table rows={rows} rowKey={(p) => p.id} cols={[
        { key: "n", head: "Plan", render: (p) => <div><b>{p.name}</b><div style={muted}>{p.owner === "platform" ? "Platform" : db.vendors.find((v) => v.id === p.owner)?.name}</div></div> },
        { key: "e", head: "Entitlement", render: (p) => `${p.entitlement} × ${db.skus.find((s) => s.id === p.skuId)?.name}` },
        { key: "p", head: "Price / validity", render: (p) => `${inr(p.price)} / ${p.validityDays}d` },
        { key: "r", head: "Rules", render: (p) => <span style={muted}>{p.mode} · {p.maxPerDay ? `${p.maxPerDay}/day` : "no cap"} · {p.unused} · {p.autoRenew ? "auto-renew" : "manual"}</span> },
        { key: "s", head: "Active subs", align: "right", render: (p) => subs(p.id).filter((s) => s.status === "Active").length },
        { key: "u", head: "Usage", align: "right", render: (p) => { const ss = subs(p.id); const tot = ss.reduce((a, s) => a + p.entitlement + s.carried, 0); return tot ? `${Math.round((ss.reduce((a, s) => a + s.used, 0) / tot) * 100)}%` : "—"; } },
        { key: "a", head: "Live", render: (p) => <Switch on={p.active} onChange={(x) => { update((d) => { d.plans.find((y) => y.id === p.id)!.active = x; audit(d, actor.name, actor.role, x ? "Plan activated" : "Plan paused", p.name, ""); }); toast(x ? "Plan live" : "Plan paused"); }} label="Active" /> },
        { key: "x", head: "", align: "right", render: (p) => (p.owner === "platform" ? <Btn kind="ghost" small onClick={() => setEdit({ ...p })}>Edit</Btn> : null) },
      ]} />
      {edit && (
        <Modal title={edit.id ? "Edit platform plan" : "New platform plan"} onClose={() => setEdit(null)} footer={<><Btn safe kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
          <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={input} /></Field>
          <Field label="Description"><input value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} style={input} /></Field>
          <div className="admin-grid-even" style={{ gap: 10 }}>
            <Field label="Product"><select value={edit.skuId} onChange={(e) => setEdit({ ...edit, skuId: e.target.value })} style={input}>{db.skus.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Price (₹)"><input value={edit.price || ""} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Units"><input value={edit.entitlement} onChange={(e) => setEdit({ ...edit, entitlement: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Validity (days)"><input value={edit.validityDays} onChange={(e) => setEdit({ ...edit, validityDays: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Delivery"><select value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value as Plan["mode"] })} style={input}><option>Both</option><option>On-demand</option><option>Scheduled</option></select></Field>
            <Field label="Max per day"><select value={edit.maxPerDay ?? 0} onChange={(e) => setEdit({ ...edit, maxPerDay: Number(e.target.value) || null })} style={input}><option value={0}>No limit</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="Unused units"><select value={edit.unused} onChange={(e) => setEdit({ ...edit, unused: e.target.value as Plan["unused"] })} style={input}><option>Carry forward</option><option>Expire</option></select></Field>
            <Field label="Auto-renew"><select value={edit.autoRenew ? "1" : "0"} onChange={(e) => setEdit({ ...edit, autoRenew: e.target.value === "1" })} style={input}><option value="1">Allowed</option><option value="0">Manual only</option></select></Field>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
