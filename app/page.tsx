import Link from "next/link";

const APPS = [
  ["/customer", "Customer App (Android)", "Order water, subscribe, pay, track live. Demo: 9876543210 / OTP 1234"],
  ["/driver", "Driver App (Android)", "Accept requests, navigate, can exchange, OTP proof. Demo: Amit / OTP 1234"],
  ["/vendor", "Vendor Web Panel", "Products, pricing, service areas, drivers, vehicles, orders. green@watersupply.in / demo@123"],
  ["/admin", "Super Admin Panel", "Vendors, dispatch, pricing, settlements, RBAC. admin@aquaadmin.in / demo@123"],
];

export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "var(--blue-dark)" }}>Water Delivery</h1>
      <p style={{ color: "var(--ink-soft)" }}>Pure Water. Healthier Tomorrow. — demo of all four apps (shared demo data in this browser; open two tabs to see dispatch live).</p>
      <div className="portal-grid">
        {APPS.map(([href, t, d]) => (
          <Link key={href} href={href} style={{ background: "var(--surface)", borderRadius: 18, padding: 20, boxShadow: "var(--shadow-card)", textDecoration: "none", color: "var(--ink)" }}>
            <b style={{ fontSize: 17 }}>{t} →</b>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>{d}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
