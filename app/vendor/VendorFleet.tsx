"use client";

import { useState } from "react";
import CityMap from "../components/CityMap";
import { audit, notify } from "../lib/actions";
import { DONE, driverBlockers, fmtDT, fmtDate, inr } from "../lib/logic";
import { update, useData } from "../lib/store";
import type { AccountStatus, DB, Driver, Vehicle } from "../lib/types";
import { avg, deliveryMins } from "../web/analytics";
import { Badge, Btn, Field, Filter, Initials, KV, Modal, Panel, SBadge, SearchBox, Stat, Table, input, muted } from "../web/kit";
import type { VProps } from "./VendorApp";

export function driverStats(db: DB, id: string) {
  const os = db.orders.filter((o) => o.driverId === id);
  const done = os.filter((o) => DONE.includes(o.status));
  const tried = db.orders.flatMap((o) => o.attempts).filter((a) => a.driverId === id);
  return {
    done: done.length,
    cancelled: os.filter((o) => o.status === "Cancelled").length,
    rating: avg(done.filter((o) => o.rating).map((o) => o.rating!.driver)),
    acceptance: tried.length ? Math.round((tried.filter((a) => a.result === "Accepted").length / tried.length) * 100) : 100,
    avgMins: Math.round(avg(done.map(deliveryMins).filter((x): x is number => x !== null))),
    cod: done.filter((o) => o.payment.method === "COD").reduce((s, o) => s + o.total, 0),
    recent: os.slice(0, 6),
  };
}

export function availability(db: DB, d: Driver) {
  const b = driverBlockers(db, d);
  if (b.includes("On a delivery")) return <Badge tone="blue">On delivery</Badge>;
  if (d.status !== "Active" || d.kyc !== "Verified") return <Badge tone="grey">Not eligible</Badge>;
  return d.online ? <Badge tone="green">Online</Badge> : <Badge tone="grey">Offline</Badge>;
}

export function DriverDetail({ d, onClose }: { d: Driver; onClose: () => void }) {
  const db = useData();
  const s = driverStats(db, d.id);
  const vh = db.vehicles.find((v) => v.id === d.vehicleId);
  return (
    <Modal wide title={d.name} onClose={onClose}>
      <div className="admin-grid-even">
        <div>
          <KV k="Mobile" v={d.phone} />
          <KV k="Vendor" v={db.vendors.find((v) => v.id === d.vendorId)?.name} />
          <KV k="Status / KYC" v={<span><SBadge s={d.status} /> <SBadge s={d.kyc} /></span>} />
          <KV k="Driving licence" v={d.licence} />
          <KV k="ID proof" v={d.idProof} />
          <KV k="Vehicle" v={vh ? `${vh.number} · ${vh.type}` : "—"} />
          <KV k="Joined" v={fmtDate(d.joinedAt)} />
          <KV k="Completed deliveries" v={s.done} />
          <KV k="Acceptance rate" v={`${s.acceptance}%`} />
          <KV k="Avg delivery time" v={s.avgMins ? `${s.avgMins} min` : "—"} />
          <KV k="Rating" v={s.rating ? `★ ${s.rating.toFixed(2)}` : "—"} />
          <KV k="COD collected (all time)" v={inr(s.cod)} />
        </div>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>Current / last known location</p>
          <CityMap height={200} fit={[d.loc]} localities={db.localities.filter((l) => l.cityId === "noida")} markers={[{ id: d.id, pt: d.loc, kind: "driver", label: d.name.split(" ")[0] }]} />
          <p style={{ margin: "12px 0 6px", fontSize: 13, fontWeight: 700 }}>Recent orders</p>
          {s.recent.map((o) => <KV key={o.id} k={`#${o.id} · ${fmtDT(o.createdAt)}`} v={<SBadge s={o.status} />} />)}
        </div>
      </div>
    </Modal>
  );
}

const FILTERS = ["All", "Online", "Offline", "Pending", "Suspended"] as const;

export function VendorDrivers({ vendorId, actor, toast }: VProps) {
  const db = useData();
  const v = db.vendors.find((x) => x.id === vendorId)!;
  const mine = db.drivers.filter((d) => d.vendorId === vendorId);
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<Driver | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", licence: "", idProof: "" });

  const rows = mine.filter((d) => (f === "All" || (f === "Online" && d.online && d.status === "Active") || (f === "Offline" && !d.online && d.status === "Active") || (f === "Pending" && (d.status === "Pending" || d.kyc === "Pending")) || (f === "Suspended" && (d.status === "Suspended" || d.status === "Inactive")))
    && (!q || d.name.toLowerCase().includes(q.toLowerCase()) || d.phone.includes(q)));

  const setStatus = (d: Driver, s: AccountStatus) => {
    if (s !== "Active" && driverBlockers(db, d).includes("On a delivery")) { toast("Driver is on a delivery — try after it completes"); return; }
    update((x) => { const y = x.drivers.find((z) => z.id === d.id)!; y.status = s; if (s !== "Active") y.online = false; audit(x, actor.name, actor.role, "Driver status changed", d.name, `${d.status} → ${s}`); });
    toast(`${d.name} is now ${s.toLowerCase()}`);
  };
  const add = () => {
    if (form.name.trim().length < 3 || !/^[6-9]\d{9}$/.test(form.phone) || form.licence.length < 6) { toast("Enter name, valid mobile and licence number"); return; }
    if (db.drivers.some((d) => d.phone === form.phone)) { toast("This mobile number is already registered"); return; }
    update((x) => {
      x.drivers.push({ id: `d${Date.now()}`, vendorId, name: form.name.trim(), phone: form.phone, status: "Pending", kyc: "Pending", licence: form.licence, idProof: form.idProof || "Pending upload", online: false, loc: { ...v.location }, vehicleId: null, joinedAt: Date.now() });
      audit(x, actor.name, actor.role, "Driver added", form.name.trim(), `KYC submitted for verification`);
      notify(x, "admin", "Driver KYC submitted", `${form.name.trim()} (${v.name}) needs verification.`);
    });
    setAdding(false); setForm({ name: "", phone: "", licence: "", idProof: "" });
    toast("Driver added — awaiting platform verification");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid-4">
        <Stat label="Drivers" value={String(mine.length)} />
        <Stat label="Online now" value={String(mine.filter((d) => d.online && d.status === "Active").length)} tone="green" />
        <Stat label="On a delivery" value={String(mine.filter((d) => driverBlockers(db, d).includes("On a delivery")).length)} tone="purple" />
        <Stat label="Pending verification" value={String(mine.filter((d) => d.kyc === "Pending").length)} tone="amber" />
      </div>
      <Panel pad={false} title={<Filter options={FILTERS} value={f} onChange={setF} />} actions={<><SearchBox value={q} onChange={setQ} placeholder="Search name or mobile" /><Btn onClick={() => setAdding(true)}>+ Add driver</Btn></>}>
        <Table rows={rows} rowKey={(d) => d.id} onRow={setView} cols={[
          { key: "n", head: "Driver", render: (d) => <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Initials name={d.name} /><div><b>{d.name}</b><div style={muted}>{d.phone}</div></div></div> },
          { key: "s", head: "Account", render: (d) => <SBadge s={d.status} /> },
          { key: "k", head: "KYC", render: (d) => <SBadge s={d.kyc} /> },
          { key: "a", head: "Availability", render: (d) => availability(db, d) },
          { key: "v", head: "Vehicle", render: (d) => <span style={muted}>{db.vehicles.find((x) => x.id === d.vehicleId)?.number ?? "—"}</span> },
          { key: "p", head: "Deliveries / rating", render: (d) => { const s = driverStats(db, d.id); return `${s.done} · ${s.rating ? `★ ${s.rating.toFixed(1)}` : "—"}`; } },
          { key: "x", head: "", align: "right", render: (d) => (
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {d.status === "Active" ? <Btn kind="danger" small onClick={() => setStatus(d, "Suspended")}>Suspend</Btn>
                : d.status === "Pending" ? <span style={muted}>Awaiting platform</span>
                : <Btn kind="go" small onClick={() => setStatus(d, "Active")}>Activate</Btn>}
              {d.status !== "Inactive" && d.status !== "Pending" && <Btn kind="ghost" small onClick={() => setStatus(d, "Inactive")}>Deactivate</Btn>}
            </div>
          ) },
        ]} />
      </Panel>
      {view && <DriverDetail d={db.drivers.find((x) => x.id === view.id)!} onClose={() => setView(null)} />}
      {adding && (
        <Modal title="Add driver" onClose={() => setAdding(false)} footer={<><Btn safe kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn><Btn onClick={add}>Submit for verification</Btn></>}>
          <Field label="Full name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} /></Field>
          <Field label="Mobile number" hint="The driver logs in to the Driver app with this number"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} style={input} /></Field>
          <Field label="Driving licence number"><input value={form.licence} onChange={(e) => setForm({ ...form, licence: e.target.value.toUpperCase() })} style={input} /></Field>
          <Field label="ID proof (Aadhaar / PAN, last 4 digits)"><input value={form.idProof} onChange={(e) => setForm({ ...form, idProof: e.target.value })} style={input} /></Field>
          <p style={muted}>Profile photo and document uploads go to secure storage once the backend is connected.</p>
        </Modal>
      )}
    </div>
  );
}

const TYPES: Vehicle["type"][] = ["E-Rickshaw", "Tempo", "Pickup Van", "Bike"];

export function VendorVehicles({ vendorId, actor, toast }: VProps) {
  const db = useData();
  const mine = db.vehicles.filter((v) => v.vendorId === vendorId);
  const drivers = db.drivers.filter((d) => d.vendorId === vendorId && d.status !== "Inactive");
  const [edit, setEdit] = useState<Vehicle | null>(null);

  const save = () => {
    if (!edit) return;
    if (!/^[A-Z]{2}\d{1,2}\s?[A-Z]{0,3}\s?\d{3,4}$/.test(edit.number.trim())) { toast("Enter a valid registration number, e.g. UP16 ER 4521"); return; }
    const id = edit.id || `vh${Date.now()}`;
    update((d) => {
      const rec = { ...edit, id, number: edit.number.trim() };
      if (edit.id) Object.assign(d.vehicles.find((x) => x.id === id)!, rec); else d.vehicles.push(rec);
      d.drivers.forEach((dr) => { if (dr.vehicleId === id && dr.id !== rec.driverId) dr.vehicleId = null; });
      d.vehicles.forEach((vh) => { if (vh.id !== id && rec.driverId && vh.driverId === rec.driverId) vh.driverId = null; });
      if (rec.driverId) d.drivers.find((x) => x.id === rec.driverId)!.vehicleId = id;
      audit(d, actor.name, actor.role, edit.id ? "Vehicle updated" : "Vehicle added", rec.number, `${rec.type} · ${rec.status}`);
    });
    setEdit(null); toast("Vehicle saved");
  };

  return (
    <Panel pad={false} title={`${mine.length} vehicles`} actions={<Btn onClick={() => setEdit({ id: "", vendorId, number: "", type: "E-Rickshaw", capacity: 24, status: "Active", driverId: null })}>+ Add vehicle</Btn>}>
      <Table rows={mine} rowKey={(v) => v.id} cols={[
        { key: "n", head: "Number", render: (v) => <b>{v.number}</b> },
        { key: "t", head: "Type", render: (v) => v.type },
        { key: "c", head: "Capacity", render: (v) => `${v.capacity} cans` },
        { key: "d", head: "Assigned driver", render: (v) => db.drivers.find((d) => d.id === v.driverId)?.name ?? <span style={muted}>Unassigned</span> },
        { key: "s", head: "Status", render: (v) => <SBadge s={v.status} /> },
        { key: "x", head: "", align: "right", render: (v) => <Btn kind="ghost" small onClick={() => setEdit({ ...v })}>Edit</Btn> },
      ]} />
      {edit && (
        <Modal title={edit.id ? "Edit vehicle" : "Add vehicle"} onClose={() => setEdit(null)} footer={<><Btn safe kind="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
          <Field label="Registration number"><input value={edit.number} onChange={(e) => setEdit({ ...edit, number: e.target.value.toUpperCase() })} placeholder="UP16 ER 4521" style={input} /></Field>
          <div className="admin-grid-even" style={{ gap: 10 }}>
            <Field label="Type"><select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Vehicle["type"] })} style={input}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Capacity (20L cans)"><input value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value.replace(/\D/g, "")) })} style={input} /></Field>
            <Field label="Status"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Vehicle["status"] })} style={input}><option>Active</option><option>Maintenance</option><option>Inactive</option></select></Field>
            <Field label="Assigned driver"><select value={edit.driverId ?? ""} onChange={(e) => setEdit({ ...edit, driverId: e.target.value || null })} style={input}><option value="">Unassigned</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
