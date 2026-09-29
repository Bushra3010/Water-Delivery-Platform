"use client";

import { useEffect, useState } from "react";
import { BRAND } from "../components/Brand";
import { useDispatchEngine } from "../lib/actions";
import { DAY, FINDING, fmtDate, vendorBlockers } from "../lib/logic";
import { session, useDB } from "../lib/store";
import { Btn, Field, input } from "../web/kit";
import { WebLogin, WebShell, useToast, type NavGroup } from "../web/Shell";
import type { Actor } from "../web/OrderModal";
import { VendorDashboard, VendorOrders } from "./VendorOps";
import { VendorAreas, VendorPlans, VendorProducts } from "./VendorSetup";
import { VendorDrivers, VendorVehicles } from "./VendorFleet";
import { VendorPayments, VendorReports, VendorSettings } from "./VendorMoney";

export type VSection = "dashboard" | "orders" | "products" | "areas" | "drivers" | "vehicles" | "subscriptions" | "payments" | "reports" | "settings";

const NAV: NavGroup<VSection>[] = [
  { group: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: "▦" }, { id: "orders", label: "Orders", icon: "🧾" }] },
  { group: "Catalogue", items: [{ id: "products", label: "Products & Pricing", icon: "💧" }, { id: "areas", label: "Service Areas", icon: "🗺️" }, { id: "subscriptions", label: "Subscriptions", icon: "🔁" }] },
  { group: "Fleet", items: [{ id: "drivers", label: "Drivers", icon: "🧑‍✈️" }, { id: "vehicles", label: "Vehicles", icon: "🛺" }] },
  { group: "Business", items: [{ id: "payments", label: "Payments & Settlements", icon: "💳" }, { id: "reports", label: "Reports", icon: "📊" }, { id: "settings", label: "Settings", icon: "⚙️" }] },
];

const TITLES: Record<VSection, string> = {
  dashboard: "Dashboard", orders: "Orders", products: "Products & Pricing", areas: "Service Areas", drivers: "Drivers", vehicles: "Vehicles",
  subscriptions: "Customer Subscriptions", payments: "Payments & Settlements", reports: "Reports", settings: "Business Settings",
};

export interface VProps { vendorId: string; actor: Actor; toast: (m: string) => void; go: (s: VSection) => void }

export default function VendorApp() {
  const db = useDB();
  useDispatchEngine();
  const [vid, setVid] = useState<string | null | undefined>(undefined);
  const [section, setSection] = useState<VSection>("dashboard");
  const { show, el } = useToast();
  useEffect(() => { setVid(session.get("vendor")); }, []);

  if (!db || vid === undefined) return null;
  const v = vid ? db.vendors.find((x) => x.id === vid) : undefined;
  if (!v || v.status === "Blocked") return <VendorLogin onDone={(id) => { session.set("vendor", id); setVid(id); }} />;

  const actor = { name: v.owner, role: "Vendor Admin" };
  const props: VProps = { vendorId: v.id, actor, toast: show, go: setSection };
  const blockers = vendorBlockers(db, v, Date.now());
  const myOrders = db.orders.filter((o) => o.vendorId === v.id || o.attempts.some((a) => a.vendorId === v.id));

  return (
    <WebShell brand={BRAND.vendorPanel} sub="Vendor panel" nav={NAV} section={section} onSection={setSection} title={TITLES[section]}
      user={{ name: v.name, sub: v.owner }} onLogout={() => { session.set("vendor", null); setVid(null); }} noticeTo={`vendor:${v.id}`} toast={el}
      badges={{
        orders: myOrders.filter((o) => FINDING.includes(o.status) || (o.status === "Failed Assignment" && o.createdAt > Date.now() - DAY)).length,
        drivers: db.drivers.filter((d) => d.vendorId === v.id && d.kyc === "Pending").length,
      }}>
      {blockers.length > 0 && (
        <div role="alert" style={{ background: "var(--warning)", border: "1px solid var(--warning-border)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--text-secondary)" }}>
          <b style={{ color: "var(--warning-text)" }}>You are not receiving new orders:</b> {blockers.join(" · ")}.
          {v.planExpiry < Date.now() && v.monetization.mode !== "commission" && <> Platform plan expired {fmtDate(v.planExpiry)} — policy: <b>{db.settings.vendorExpiry}</b>.</>}
        </div>
      )}
      {section === "dashboard" && <VendorDashboard {...props} />}
      {section === "orders" && <VendorOrders {...props} />}
      {section === "products" && <VendorProducts {...props} />}
      {section === "areas" && <VendorAreas {...props} />}
      {section === "subscriptions" && <VendorPlans {...props} />}
      {section === "drivers" && <VendorDrivers {...props} />}
      {section === "vehicles" && <VendorVehicles {...props} />}
      {section === "payments" && <VendorPayments {...props} />}
      {section === "reports" && <VendorReports {...props} />}
      {section === "settings" && <VendorSettings {...props} />}
    </WebShell>
  );
}

function VendorLogin({ onDone }: { onDone: (id: string) => void }) {
  const db = useDB()!;
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = db.vendors.find((x) => x.email === email.trim().toLowerCase());
    if (!v || pw !== "demo@123") { setErr("Wrong email or password."); return; }
    if (v.status === "Blocked") { setErr("This vendor account is blocked. Contact the platform team."); return; }
    onDone(v.id);
  };
  return (
    <WebLogin title={`${BRAND.vendorPanel} · Vendor login`} body="Manage your products, drivers, service areas and orders. Vendor accounts are created by the platform team.">
      <form onSubmit={submit}>
        <Field label="Email"><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} style={input} autoComplete="username" /></Field>
        <Field label="Password"><input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} style={input} autoComplete="current-password" /></Field>
        {err && <p role="alert" style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--error-text)", fontWeight: 600 }}>{err}</p>}
        <Btn safe type="submit" disabled={!email || !pw}>Sign in</Btn>
      </form>
      <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "var(--gold-tint)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        Password for all demo vendors: <b>demo@123</b><br />
        {db.vendors.map((v) => (
          <button key={v.id} type="button" onClick={() => { setEmail(v.email); setPw("demo@123"); setErr(null); }} style={{ background: "none", border: "none", padding: "0 8px 0 0", color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
            {v.name}{v.status !== "Active" ? ` (${v.status.toLowerCase()})` : v.planExpiry < Date.now() && v.monetization.mode !== "commission" ? " (plan expired)" : ""}
          </button>
        ))}
      </div>
    </WebLogin>
  );
}
