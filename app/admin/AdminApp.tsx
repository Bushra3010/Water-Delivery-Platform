"use client";

import { useEffect, useState } from "react";
import { BRAND } from "../components/Brand";
import { useDispatchEngine } from "../lib/actions";
import { DAY, FINDING } from "../lib/logic";
import { useDB } from "../lib/store";
import type { AdminSection, Role } from "../lib/types";
import { Btn, Field, input } from "../web/kit";
import { WebLogin, WebShell, useToast, type NavGroup } from "../web/Shell";
import type { Actor } from "../web/OrderModal";
import { AdminCustomers, AdminDashboard, AdminDrivers, AdminOrders } from "./AdminOps";
import { AdminMonetization, AdminPlans, AdminPricing, AdminVendors } from "./AdminVendors";
import { AdminAds, AdminCoupons, AdminPayments, AdminSettlements } from "./AdminFinance";
import { AdminAudit, AdminCities, AdminRbac, AdminReports, AdminSettings } from "./AdminSystem";

const NAV: NavGroup<AdminSection>[] = [
  { group: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: "▦" }, { id: "orders", label: "Orders & Dispatch", icon: "🧾" }] },
  { group: "Partners & people", items: [{ id: "vendors", label: "Vendors", icon: "🏪" }, { id: "drivers", label: "Drivers", icon: "🧑‍✈️" }, { id: "customers", label: "Customers", icon: "👥" }] },
  { group: "Commercials", items: [{ id: "pricing", label: "Pricing Controls", icon: "⚖️" }, { id: "monetization", label: "Vendor Monetization", icon: "🏷️" }, { id: "plans", label: "Customer Plans", icon: "🔁" }, { id: "coupons", label: "Coupons", icon: "🎟️" }, { id: "ads", label: "Advertising", icon: "📢" }] },
  { group: "Finance", items: [{ id: "payments", label: "Payments & Wallet", icon: "💳" }, { id: "settlements", label: "Settlements", icon: "🏦" }] },
  { group: "Platform", items: [{ id: "cities", label: "Cities & Zones", icon: "🗺️" }, { id: "reports", label: "Reports", icon: "📊" }, { id: "rbac", label: "Roles & Staff", icon: "🔐" }, { id: "audit", label: "Audit Log", icon: "📜" }, { id: "settings", label: "System Settings", icon: "⚙️" }] },
];

const TITLES: Record<AdminSection, string> = {
  dashboard: "Dashboard", orders: "Orders & Dispatch", vendors: "Vendor Management", drivers: "Driver Oversight", customers: "Customer Management",
  pricing: "Pricing Controls", monetization: "Vendor Monetization", plans: "Customer Subscription Plans", coupons: "Coupons", ads: "Advertising",
  payments: "Payments & Wallet", settlements: "Vendor Settlements", cities: "Cities & Service Zones", reports: "Reports & Exports",
  rbac: "Roles, Permissions & Staff", audit: "Audit Log", settings: "System Settings",
};

export interface AProps { actor: Actor; role: Role; toast: (m: string) => void; go: (s: AdminSection) => void }

const KEY = "aqua:admin";
const readSess = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const writeSess = (v: string | null) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } };

export default function AdminApp() {
  const db = useDB();
  useDispatchEngine();
  const [staffId, setStaffId] = useState<string | null | undefined>(undefined);
  const [section, setSection] = useState<AdminSection>("dashboard");
  const { show, el } = useToast();
  useEffect(() => { setStaffId(readSess()); }, []);

  if (!db || staffId === undefined) return null;
  const staff = staffId ? db.staff.find((s) => s.id === staffId && s.active) : undefined;
  const role = staff ? db.roles.find((r) => r.id === staff.roleId) : undefined;
  if (!staff || !role) return <AdminLogin onDone={(id) => { writeSess(id); setStaffId(id); setSection("dashboard"); }} />;

  const allowed = new Set(role.sections);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.id)) })).filter((g) => g.items.length);
  const current = allowed.has(section) ? section : role.sections[0];
  const props: AProps = { actor: { name: staff.name, role: role.name }, role, toast: show, go: (s) => allowed.has(s) && setSection(s) };

  return (
    <WebShell brand={BRAND.adminPanel} sub="Super admin" nav={nav} section={current} onSection={setSection} title={TITLES[current]}
      user={{ name: staff.name, sub: role.name }} onLogout={() => { writeSess(null); setStaffId(null); }} readOnly={role.readOnly} noticeTo="admin" toast={el}
      badges={{
        orders: db.orders.filter((o) => FINDING.includes(o.status) && o.status !== "Placed").length + db.orders.filter((o) => o.status === "Failed Assignment" && o.createdAt > Date.now() - DAY).length,
        vendors: db.vendors.filter((v) => v.status === "Pending" || v.kyc === "Pending").length,
        drivers: db.drivers.filter((d) => d.kyc === "Pending").length,
        payments: db.orders.filter((o) => o.payment.status === "Refund Pending").length,
        settlements: db.settlements.filter((s) => s.status !== "Paid").length,
      }}>
      {current === "dashboard" && <AdminDashboard {...props} />}
      {current === "orders" && <AdminOrders {...props} />}
      {current === "vendors" && <AdminVendors {...props} />}
      {current === "drivers" && <AdminDrivers {...props} />}
      {current === "customers" && <AdminCustomers {...props} />}
      {current === "pricing" && <AdminPricing {...props} />}
      {current === "monetization" && <AdminMonetization {...props} />}
      {current === "plans" && <AdminPlans {...props} />}
      {current === "coupons" && <AdminCoupons {...props} />}
      {current === "ads" && <AdminAds {...props} />}
      {current === "payments" && <AdminPayments {...props} />}
      {current === "settlements" && <AdminSettlements {...props} />}
      {current === "cities" && <AdminCities {...props} />}
      {current === "reports" && <AdminReports {...props} />}
      {current === "rbac" && <AdminRbac {...props} />}
      {current === "audit" && <AdminAudit {...props} />}
      {current === "settings" && <AdminSettings {...props} />}
    </WebShell>
  );
}

function AdminLogin({ onDone }: { onDone: (id: string) => void }) {
  const db = useDB()!;
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = db.staff.find((x) => x.email === email.trim().toLowerCase());
    if (!s || pw !== "demo@123") { setErr("Wrong email or password."); return; }
    if (!s.active) { setErr("This staff account is disabled."); return; }
    onDone(s.id);
  };
  return (
    <WebLogin title={`${BRAND.adminPanel} · Super Admin`} body="Platform control for vendors, customers, dispatch, pricing, payments and settings. What you can see depends on your role.">
      <form onSubmit={submit}>
        <Field label="Work email"><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} style={input} autoComplete="username" /></Field>
        <Field label="Password"><input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} style={input} autoComplete="current-password" /></Field>
        {err && <p role="alert" style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--error-text)", fontWeight: 600 }}>{err}</p>}
        <Btn safe type="submit" disabled={!email || !pw}>Sign in</Btn>
      </form>
      <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "var(--gold-tint)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>
        Password for all demo staff: <b>demo@123</b> — sign in as a role:<br />
        {db.staff.map((s) => (
          <button key={s.id} type="button" onClick={() => { setEmail(s.email); setPw("demo@123"); setErr(null); }} style={{ background: "none", border: "none", padding: "0 8px 0 0", color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
            {db.roles.find((r) => r.id === s.roleId)?.name}
          </button>
        ))}
      </div>
    </WebLogin>
  );
}
