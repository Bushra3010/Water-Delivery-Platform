"use client";

import { useState } from "react";
import CityMap, { type Area } from "../components/CityMap";
import ProductArt from "../components/ProductArt";
import { audit } from "../lib/actions";
import { areaChecks, fmtDT, fmtDate, inr, serves } from "../lib/logic";
import { update, useData } from "../lib/store";
import type { Plan, Pt, ServiceArea, VendorProduct } from "../lib/types";
import { Badge, Btn, Field, KV, Modal, Panel, SBadge, Stat, Switch, Table, input, muted } from "../web/kit";
import type { VProps } from "./VendorApp";

/* ───────────────────────── Products & pricing ───────────────────────── */

export function VendorProducts({ vendorId, actor, toast }: VProps) {
  const db = useData();
  const v = db.vendors.find((x) => x.id === vendorId)!;
  const mine = db.products.filter((p) => p.vendorId === vendorId);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [hist, setHist] = useState<VendorProduct | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const rule = (skuId: string) => db.priceRules.find((r) => r.skuId === skuId)!;
  const unlisted = db.skus.filter((s) => !mine.some((p) => p.skuId === s.id));

  const patch = (id: string, p: Partial<VendorProduct>, what: string) => {
    update((d) => { Object.assign(d.products.find((x) => x.id === id)!, p); audit(d, actor.name, actor.role, "Product updated", `${v.name} · ${db.skus.find((s) => s.id === mine.find((m) => m.id === id)!.skuId)!.name}`, what); });
    toast(what);
  };
  const savePrice = (p: VendorProduct) => {
    const n = Number(draft[p.id]);
    const r = rule(p.skuId);
    if (!Number.isFinite(n) || n < r.min || n > r.max) { toast(`Price must be between ${inr(r.min)} and ${inr(r.max)}`); return; }
    update((d) => {
      const x = d.products.find((y) => y.id === p.id)!;
      x.history.push({ at: Date.now(), price: n, by: actor.name });
      audit(d, actor.name, actor.role, "Price updated", `${v.name} · ${db.skus.find((s) => s.id === p.skuId)!.name}`, `${inr(x.price)} → ${inr(n)}`);
      x.price = n;
    });
    setDraft((x) => { const c = { ...x }; delete c[p.id]; return c; });
    toast("Price updated — live in the customer app");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel pad={false} title="Your products" actions={<Btn disabled={!unlisted.length} onClick={() => { setAdding(unlisted[0].id); setNewPrice(String(rule(unlisted[0].id).min)); }}>+ Add product</Btn>}>
        <Table rows={mine} rowKey={(p) => p.id} cols={[
          { key: "n", head: "Product", render: (p) => { const s = db.skus.find((x) => x.id === p.skuId)!; return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><ProductArt art={s.art} size={36} /><div><b>{s.name}</b><div style={muted}>{s.size}{s.returnable ? " · can return" : ""}</div></div></div>; } },
          { key: "r", head: "Allowed range", render: (p) => <span style={muted}>{inr(rule(p.skuId).min)} – {inr(rule(p.skuId).max)}</span> },
          { key: "p", head: "Selling price", render: (p) => (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input aria-label="Price" value={draft[p.id] ?? String(p.price)} onChange={(e) => setDraft((x) => ({ ...x, [p.id]: e.target.value.replace(/\D/g, "") }))} style={{ ...input, width: 80, padding: "6px 8px" }} />
              {draft[p.id] !== undefined && Number(draft[p.id]) !== p.price && <Btn small onClick={() => savePrice(p)}>Save</Btn>}
            </div>
          ) },
          { key: "t", head: "GST", render: (p) => v.gstin ? <Switch on={p.taxable} onChange={(x) => patch(p.id, { taxable: x }, x ? "GST applied" : "Marked tax-exempt")} label="Taxable" /> : <span style={muted}>Not registered</span> },
          { key: "s", head: "In stock", render: (p) => <Switch on={p.inStock} onChange={(x) => patch(p.id, { inStock: x }, x ? "Back in stock" : "Marked out of stock")} label="In stock" /> },
          { key: "a", head: "Listed", render: (p) => <Switch on={p.active} onChange={(x) => patch(p.id, { active: x }, x ? "Product listed" : "Product hidden")} label="Listed" /> },
          { key: "h", head: "", align: "right", render: (p) => <Btn safe kind="ghost" small onClick={() => setHist(p)}>History</Btn> },
        ]} />
      </Panel>
      <p style={{ ...muted, margin: 0 }}>Price ranges are set by the platform. Customers never pick a vendor — they see the price of the partner that is dispatched first for their address.</p>

      {hist && (
        <Modal title="Price history" onClose={() => setHist(null)}>
          {[...hist.history].reverse().map((h, i) => <KV key={i} k={fmtDT(h.at)} v={`${inr(h.price)} · ${h.by}`} />)}
        </Modal>
      )}
      {adding && (
        <Modal title="Add product" onClose={() => setAdding(null)} footer={<>
          <Btn safe kind="ghost" onClick={() => setAdding(null)}>Cancel</Btn>
          <Btn onClick={() => {
            const r = rule(adding); const n = Number(newPrice);
            if (n < r.min || n > r.max) { toast(`Price must be between ${inr(r.min)} and ${inr(r.max)}`); return; }
            update((d) => { d.products.push({ id: `p_${vendorId}_${adding}`, vendorId, skuId: adding, price: n, active: true, inStock: true, taxable: !!v.gstin, history: [{ at: Date.now(), price: n, by: actor.name }] }); audit(d, actor.name, actor.role, "Product added", v.name, db.skus.find((s) => s.id === adding)!.name); });
            setAdding(null); toast("Product added");
          }}>Add</Btn>
        </>}>
          <Field label="Product (platform catalogue)">
            <select value={adding} onChange={(e) => { setAdding(e.target.value); setNewPrice(String(rule(e.target.value).min)); }} style={input}>
              {unlisted.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Selling price (₹)" hint={`Allowed: ${inr(rule(adding).min)} – ${inr(rule(adding).max)}`}>
            <input value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, ""))} style={input} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────────── Service areas ───────────────────────── */

export function VendorAreas({ vendorId, actor, toast }: VProps) {
  const db = useData();
  const v = db.vendors.find((x) => x.id === vendorId)!;
  const [a, setA] = useState<ServiceArea>(structuredClone(v.area));
  const [drawing, setDrawing] = useState(false);
  const [pin, setPin] = useState("");
  const [test, setTest] = useState("l12");
  const locs = db.localities.filter((l) => l.cityId === v.cityId);
  const dirty = JSON.stringify(a) !== JSON.stringify(v.area);
  const tl = locs.find((l) => l.id === test)!;
  const spot = { pt: tl.center, pin: tl.pin, localityId: tl.id };
  const checks = areaChecks(a, v.location, spot);
  const ok = serves({ ...v, area: a }, spot);

  const areas: Area[] = [];
  if (a.radiusKm) areas.push({ kind: "circle", c: v.location, r: a.radiusKm * 100, color: "#0b5cff" });
  if (a.polygon && a.polygon.length >= 2) areas.push({ kind: "poly", pts: a.polygon, color: "#16a34a" });
  const covered = locs.filter((l) => a.localities.includes(l.id) || a.pins.includes(l.pin));

  const pick = (p: Pt) => { if (drawing) setA((x) => ({ ...x, polygon: [...(x.polygon ?? []), p] })); };

  return (
    <div className="admin-grid-2">
      <Panel title="Coverage map" actions={<>
        <Btn kind={drawing ? "gold" : "ghost"} small onClick={() => setDrawing((d) => !d)}>{drawing ? "✓ Done drawing" : "✏️ Draw geofence"}</Btn>
        <Btn kind="ghost" small disabled={!a.polygon} onClick={() => setA((x) => ({ ...x, polygon: null }))}>Clear geofence</Btn>
      </>}>
        <CityMap height={430} localities={locs} onPick={drawing ? pick : undefined} areas={areas}
          markers={[{ id: "v", pt: v.location, kind: "vendor", label: v.name }, ...covered.map((l) => ({ id: l.id, pt: l.center, kind: "approx" as const })), { id: "t", pt: tl.center, kind: "pin" as const, label: "Test" }]} />
        <p style={{ ...muted, marginTop: 8 }}>{drawing ? "Click the map to add geofence corners (3 or more)." : "Blue circle = radius · green shape = geofence · dots = localities / PINs you cover."}</p>
      </Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="Coverage rules" actions={<Btn disabled={!dirty || (a.polygon !== null && a.polygon.length < 3)} onClick={() => {
          update((d) => { d.vendors.find((x) => x.id === vendorId)!.area = a; audit(d, actor.name, actor.role, "Service area updated", v.name, `radius ${a.radiusKm ?? "off"}, ${a.pins.length} PINs, ${a.localities.length} localities, geofence ${a.polygon ? `${a.polygon.length} pts` : "off"}, rule ${a.rule}`); });
          toast("Service area saved — dispatch uses it immediately");
        }}>Save changes</Btn>}>
          <Field label="Combine methods">
            <select value={a.rule} onChange={(e) => setA({ ...a, rule: e.target.value as "any" | "all" })} style={input}>
              <option value="any">Serve if the address matches ANY method</option>
              <option value="all">Serve only if the address matches ALL methods</option>
            </select>
          </Field>
          <Field label="Radius from your location (km)">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Switch on={a.radiusKm !== null} onChange={(on) => setA({ ...a, radiusKm: on ? 3 : null })} label="Radius" />
              {a.radiusKm !== null && <><input type="range" min={0.5} max={8} step={0.5} value={a.radiusKm} onChange={(e) => setA({ ...a, radiusKm: Number(e.target.value) })} style={{ flex: 1 }} aria-label="Radius km" /><b>{a.radiusKm} km</b></>}
            </div>
          </Field>
          <Field label="PIN codes">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {a.pins.map((p) => <button key={p} onClick={() => setA({ ...a, pins: a.pins.filter((x) => x !== p) })} style={{ border: "none", borderRadius: 999, background: "var(--blue-tint)", color: "var(--blue)", fontWeight: 700, fontSize: 12, padding: "4px 10px", cursor: "pointer" }}>{p} ×</button>)}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit PIN" style={input} />
              <Btn kind="ghost" disabled={pin.length !== 6 || a.pins.includes(pin)} onClick={() => { setA({ ...a, pins: [...a.pins, pin] }); setPin(""); }}>Add</Btn>
            </div>
          </Field>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Named localities</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 4 }}>
            {locs.map((l) => (
              <label key={l.id} style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={a.localities.includes(l.id)} onChange={(e) => setA({ ...a, localities: e.target.checked ? [...a.localities, l.id] : a.localities.filter((x) => x !== l.id) })} />
                {l.name} <span style={muted}>{l.pin}</span>
              </label>
            ))}
          </div>
          <p style={{ ...muted, marginTop: 10 }}>Geofence: {a.polygon ? `${a.polygon.length} corners` : "none"}</p>
        </Panel>
        <Panel title="Test an address">
          <select value={test} onChange={(e) => setTest(e.target.value)} style={input} aria-label="Test locality">
            {locs.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.pin}</option>)}
          </select>
          <div style={{ marginTop: 10 }}>
            {checks.map((c) => <KV key={c.method} k={c.method} v={<Badge tone={c.ok ? "green" : "grey"}>{c.ok ? "Inside" : "Outside"}</Badge>} />)}
            <KV k={<b>Result ({a.rule === "any" ? "any" : "all"})</b>} v={<Badge tone={ok ? "green" : "red"}>{ok ? "Serviceable" : "Not served"}</Badge>} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ───────────────────────── Vendor subscription plans ───────────────────────── */

const blank = (vendorId: string, skuId: string): Plan => ({ id: "", owner: vendorId, name: "", desc: "", skuId, price: 0, validityDays: 30, entitlement: 10, mode: "Both", maxPerDay: 1, unused: "Expire", autoRenew: true, active: true });

export function VendorPlans({ vendorId, actor, toast }: VProps) {
  const db = useData();
  const plans = db.plans.filter((p) => p.owner === vendorId);
  const subs = db.subs.filter((s) => plans.some((p) => p.id === s.planId));
  const mySkus = db.products.filter((p) => p.vendorId === vendorId).map((p) => p.skuId);
  const [edit, setEdit] = useState<Plan | null>(null);
  const rule = (skuId: string) => db.priceRules.find((r) => r.skuId === skuId)!;

  const save = () => {
    if (!edit) return;
    const r = rule(edit.skuId);
    const per = edit.price / Math.max(1, edit.entitlement);
    if (!edit.name.trim() || edit.entitlement < 1 || edit.validityDays < 1) { toast("Fill in name, entitlement and validity"); return; }
    if (per < r.min * 0.75 || per > r.max) { toast(`Per-unit price ${inr(per)} must be ${inr(r.min * 0.75)}–${inr(r.max)} (platform rule)`); return; }
    update((d) => {
      if (edit.id) Object.assign(d.plans.find((p) => p.id === edit.id)!, edit);
      else d.plans.push({ ...edit, id: `pl${Date.now()}` });
      audit(d, actor.name, actor.role, edit.id ? "Plan updated" : "Plan created", edit.name, `${inr(edit.price)} · ${edit.entitlement} units · ${edit.validityDays} days`);
    });
    setEdit(null); toast("Plan saved");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat label="Your plans" value={String(plans.length)} sub={`${plans.filter((p) => p.active).length} live`} />
        <Stat label="Active subscribers" value={String(subs.filter((s) => s.status === "Active").length)} tone="green" />
        <Stat label="Units remaining" value={String(subs.filter((s) => s.status === "Active").reduce((a, s) => a + (db.plans.find((p) => p.id === s.planId)!.entitlement + s.carried - s.used), 0))} tone="purple" />
        <Stat label="Auto-renew on" value={String(subs.filter((s) => s.autoRenew && s.status === "Active").length)} tone="amber" />
      </div>
      <Panel title="Subscription plans" pad={false} actions={<Btn disabled={!mySkus.length} onClick={() => setEdit(blank(vendorId, mySkus[0]))}>+ New plan</Btn>}>
        <Table rows={plans} rowKey={(p) => p.id} empty="No plans yet — create one to offer prepaid cans." cols={[
          { key: "n", head: "Plan", render: (p) => <div><b>{p.name}</b><div style={muted}>{p.desc}</div></div> },
          { key: "e", head: "Entitlement", render: (p) => `${p.entitlement} × ${db.skus.find((s) => s.id === p.skuId)?.name}` },
          { key: "p", head: "Price", render: (p) => `${inr(p.price)} / ${p.validityDays}d` },
          { key: "m", head: "Rules", render: (p) => <span style={muted}>{p.mode} · {p.maxPerDay ? `${p.maxPerDay}/day` : "no daily cap"} · unused: {p.unused}</span> },
          { key: "s", head: "Subscribers", align: "right", render: (p) => subs.filter((s) => s.planId === p.id && s.status === "Active").length },
          { key: "a", head: "Status", render: (p) => <SBadge s={p.active ? "Active" : "Inactive"} /> },
          { key: "x", head: "", align: "right", render: (p) => <Btn kind="ghost" small onClick={() => setEdit({ ...p })}>Edit</Btn> },
        ]} />
      </Panel>
      <Panel title="Subscribers & entitlement usage" pad={false}>
        <Table rows={subs} rowKey={(s) => s.id} cols={[
          { key: "c", head: "Customer", render: (s) => db.customers.find((c) => c.id === s.customerId)?.name },
          { key: "p", head: "Plan", render: (s) => db.plans.find((p) => p.id === s.planId)?.name },
          { key: "u", head: "Used / total", render: (s) => { const p = db.plans.find((x) => x.id === s.planId)!; const t = p.entitlement + s.carried; return <div style={{ minWidth: 110 }}>{s.used} / {t}<div style={{ height: 5, borderRadius: 3, background: "var(--line)", marginTop: 3 }}><div style={{ width: `${(s.used / t) * 100}%`, height: "100%", borderRadius: 3, background: "var(--blue)" }} /></div></div>; } },
          { key: "sch", head: "Delivery", render: (s) => <span style={muted}>{s.schedule ? `${s.schedule.every} · ${s.schedule.window}` : "On-demand"}</span> },
          { key: "v", head: "Valid till", render: (s) => fmtDate(s.end) },
          { key: "r", head: "Auto-renew", render: (s) => (s.autoRenew ? "Yes" : "No") },
          { key: "st", head: "Status", render: (s) => <SBadge s={s.status} /> },
        ]} />
      </Panel>

      {edit && (
        <Modal title={edit.id ? "Edit plan" : "New plan"} onClose={() => setEdit(null)} footer={<><Btn safe kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save plan</Btn></>}>
          <Field label="Plan name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={input} /></Field>
          <Field label="Description & benefits"><input value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} style={input} /></Field>
          <div className="admin-grid-even" style={{ gap: 10 }}>
            <Field label="Product"><select value={edit.skuId} onChange={(e) => setEdit({ ...edit, skuId: e.target.value })} style={input}>{mySkus.map((s) => <option key={s} value={s}>{db.skus.find((x) => x.id === s)?.name}</option>)}</select></Field>
            <Field label="Price (₹)" hint={`Per unit ${inr(edit.price / Math.max(1, edit.entitlement))}`}><input value={edit.price || ""} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Units included"><input value={edit.entitlement} onChange={(e) => setEdit({ ...edit, entitlement: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Validity (days)"><input value={edit.validityDays} onChange={(e) => setEdit({ ...edit, validityDays: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Delivery mode"><select value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value as Plan["mode"] })} style={input}><option>Both</option><option>On-demand</option><option>Scheduled</option></select></Field>
            <Field label="Max per day"><select value={edit.maxPerDay ?? 0} onChange={(e) => setEdit({ ...edit, maxPerDay: Number(e.target.value) || null })} style={input}><option value={0}>No limit</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></Field>
            <Field label="Unused units"><select value={edit.unused} onChange={(e) => setEdit({ ...edit, unused: e.target.value as Plan["unused"] })} style={input}><option>Expire</option><option>Carry forward</option></select></Field>
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><Switch on={edit.autoRenew} onChange={(x) => setEdit({ ...edit, autoRenew: x })} label="Auto-renew" /> Allow auto-renew</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><Switch on={edit.active} onChange={(x) => setEdit({ ...edit, active: x })} label="Active" /> Visible to customers</label>
          </div>
        </Modal>
      )}
    </div>
  );
}
