/* Business rules shared by all four apps: serviceability, pricing, dispatch
 * ranking, cancellation and tracking. Pure functions over the DB — when the
 * backend lands, the same rules move into Supabase RPCs / edge functions. */

import type { Coupon, DB, Driver, Order, OrderStatus, Plan, Pt, ServiceArea, Settings, Vendor } from "./types";

/* ───────── Formatting ───────── */

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const DAY = 86_400_000;
export const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const fmtShort = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const fmtDT = (t: number) => `${fmtShort(t)}, ${fmtTime(t)}`;
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
export function ago(t: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
/** Masks a phone number for anyone who shouldn't see it in full. */
export const maskPhone = (p: string) => `${p.slice(0, 2)}******${p.slice(-2)}`;

/* ───────── Geometry (100 grid units = 1 km) ───────── */

export const distKm = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) / 100;

export function inPolygon(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Road route: along the avenue, then the cross street. */
export const route = (a: Pt, b: Pt): Pt[] => [a, { x: b.x, y: a.y }, b];

export function alongRoute(pts: Pt[], f: number): Pt {
  const segs = pts.slice(1).map((p, i) => ({ a: pts[i], b: p, len: Math.hypot(p.x - pts[i].x, p.y - pts[i].y) }));
  const total = segs.reduce((s, x) => s + x.len, 0) || 1;
  let d = Math.min(1, Math.max(0, f)) * total;
  for (const s of segs) {
    if (d <= s.len) { const k = s.len ? d / s.len : 0; return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k }; }
    d -= s.len;
  }
  return pts[pts.length - 1];
}

/** Pre-booking privacy: snap a driver to a ~400 m cell and nudge it. */
export const approx = (p: Pt, salt: number): Pt => ({ x: Math.round(p.x / 40) * 40 + ((salt * 13) % 17) - 8, y: Math.round(p.y / 40) * 40 + ((salt * 7) % 15) - 7 });

/* ───────── Serviceability ───────── */

export interface Spot { pt: Pt; pin: string; localityId: string }

export function areaChecks(area: ServiceArea, center: Pt, s: Spot) {
  const out: { method: string; ok: boolean }[] = [];
  if (area.radiusKm) out.push({ method: `Radius ${area.radiusKm} km`, ok: distKm(center, s.pt) <= area.radiusKm });
  if (area.pins.length) out.push({ method: "PIN code", ok: area.pins.includes(s.pin) });
  if (area.localities.length) out.push({ method: "Locality", ok: area.localities.includes(s.localityId) });
  if (area.polygon && area.polygon.length >= 3) out.push({ method: "Geofence", ok: inPolygon(s.pt, area.polygon) });
  return out;
}

export function serves(v: Vendor, s: Spot) {
  const c = areaChecks(v.area, v.location, s);
  if (!c.length) return false;
  return v.area.rule === "all" ? c.every((x) => x.ok) : c.some((x) => x.ok);
}

/** Does the vendor's platform subscription allow new orders right now? */
export function vendorPlanOk(v: Vendor, st: Settings, now: number) {
  if (v.monetization.mode === "commission") return true;
  if (v.planExpiry > now) return true;
  if (st.vendorExpiry === "Allow orders") return true;
  if (st.vendorExpiry === "Grace period (7 days)") return now < v.planExpiry + 7 * DAY;
  return false;
}

export function vendorBlockers(db: DB, v: Vendor, now: number) {
  const r: string[] = [];
  if (v.status !== "Active") r.push(`Account ${v.status.toLowerCase()}`);
  if (v.kyc !== "Verified") r.push(`KYC ${v.kyc.toLowerCase()}`);
  if (!vendorPlanOk(v, db.settings, now)) r.push("Platform subscription expired");
  return r;
}

export function eligibleVendors(db: DB, s: Spot, skuIds: string[], now: number, onlyVendor?: string | null) {
  return db.vendors.filter((v) =>
    (!onlyVendor || v.id === onlyVendor) &&
    vendorBlockers(db, v, now).length === 0 &&
    serves(v, s) &&
    skuIds.every((sku) => db.products.some((p) => p.vendorId === v.id && p.skuId === sku && p.active && p.inStock)),
  );
}

/* ───────── Orders ───────── */

export const LIFECYCLE: OrderStatus[] = ["Placed", "Searching", "Assigned", "Accepted", "Pickup", "Out for Delivery", "Arrived", "Delivered", "Payment Confirmed", "Completed"];
export const LIVE: OrderStatus[] = ["Accepted", "Pickup", "Out for Delivery", "Arrived"];
export const FINDING: OrderStatus[] = ["Placed", "Searching", "Assigned"];
export const DONE: OrderStatus[] = ["Delivered", "Payment Confirmed", "Completed"];
export const isOpen = (o: Order) => !DONE.includes(o.status) && o.status !== "Cancelled" && o.status !== "Failed Assignment";
export const stepOf = (s: OrderStatus) => LIFECYCLE.indexOf(s);

/** Driver is on a job or holding an offer. */
export function driverBusy(db: DB, driverId: string) {
  return db.orders.some((o) => (o.driverId === driverId && LIVE.includes(o.status)) || (o.status === "Assigned" && o.offer?.driverId === driverId));
}

export function driverBlockers(db: DB, d: Driver) {
  const r: string[] = [];
  if (d.status !== "Active") r.push(d.status);
  if (d.kyc !== "Verified") r.push(`KYC ${d.kyc.toLowerCase()}`);
  if (!d.online) r.push("Offline");
  else if (driverBusy(db, d.id)) r.push("On a delivery");
  return r;
}

export interface Candidate { driver: Driver; vendor: Vendor; km: number }

/** Nearest-first list of drivers who may receive this order next. */
export function rankDrivers(db: DB, spot: Spot, skuIds: string[], now: number, opts: { exclude?: string[]; onlyVendor?: string | null } = {}): Candidate[] {
  const vendors = eligibleVendors(db, spot, skuIds, now, opts.onlyVendor);
  const out: Candidate[] = [];
  for (const d of db.drivers) {
    const v = vendors.find((x) => x.id === d.vendorId);
    if (!v || opts.exclude?.includes(d.id) || driverBlockers(db, d).length) continue;
    const km = distKm(d.loc, spot.pt);
    if (km <= db.settings.searchRadiusKm) out.push({ driver: d, vendor: v, km });
  }
  return out.sort((a, b) => a.km - b.km);
}

export const orderSpot = (o: Order): Spot => ({ pt: o.address.pt, pin: o.address.pin, localityId: o.address.localityId });

/* ───────── Pricing ───────── */

export function couponOff(c: Coupon | undefined, subtotal: number, now: number): { off: number; error?: string } {
  if (!c) return { off: 0, error: "Invalid code" };
  if (!c.active || c.validTill < now) return { off: 0, error: "This coupon has expired" };
  if (c.used >= c.limit) return { off: 0, error: "Usage limit reached" };
  if (subtotal < c.minOrder) return { off: 0, error: `Add ${inr(c.minOrder - subtotal)} more to use this code` };
  const raw = c.kind === "flat" ? c.value : (subtotal * c.value) / 100;
  return { off: Math.round(Math.min(raw, c.maxOff ?? raw, subtotal)) };
}

export interface CartLine { skuId: string; qty: number }

export interface Quote {
  vendor: Vendor; lines: { skuId: string; name: string; qty: number; price: number }[];
  subtotal: number; tax: number; deliveryFee: number; deposit: number; discount: number; total: number;
  cansExpected: number; newCans: number; driversNearby: number; etaMin: number | null; couponError?: string;
}

/**
 * Prices come from the vendor most likely to fulfil the order (the vendor of the
 * nearest free driver, else the nearest eligible vendor). The quote is locked on
 * the order even if dispatch cascades to another vendor.
 */
export function quote(db: DB, spot: Spot, cart: CartLine[], cansHeld: number, opts: { couponCode?: string | null; subscription?: Plan | null; now: number }): Quote | { error: string } {
  const skuIds = cart.filter((l) => l.qty > 0).map((l) => l.skuId);
  if (!skuIds.length) return { error: "Add a product" };
  const onlyVendor = opts.subscription && opts.subscription.owner !== "platform" ? opts.subscription.owner : null;
  const vendors = eligibleVendors(db, spot, skuIds, opts.now, onlyVendor);
  if (!vendors.length) return { error: "No vendor delivers these products to this address yet" };
  const ranked = rankDrivers(db, spot, skuIds, opts.now, { onlyVendor });
  const vendor = ranked[0]?.vendor ?? [...vendors].sort((a, b) => distKm(a.location, spot.pt) - distKm(b.location, spot.pt))[0];

  const lines = cart.filter((l) => l.qty > 0).map((l) => {
    const p = db.products.find((x) => x.vendorId === vendor.id && x.skuId === l.skuId)!;
    return { skuId: l.skuId, name: db.skus.find((s) => s.id === l.skuId)!.name, qty: l.qty, price: opts.subscription ? 0 : p.price };
  });
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const taxable = lines.reduce((s, l) => {
    const p = db.products.find((x) => x.vendorId === vendor.id && x.skuId === l.skuId)!;
    return s + (p.taxable ? l.price * l.qty : 0);
  }, 0);
  const cansExpected = cart.reduce((s, l) => s + (db.skus.find((x) => x.id === l.skuId)?.returnable ? l.qty : 0), 0);
  const newCans = Math.max(0, cansExpected - cansHeld);

  let discount = 0;
  let couponError: string | undefined;
  if (opts.couponCode && !opts.subscription) {
    const r = couponOff(db.coupons.find((c) => c.code === opts.couponCode), subtotal, opts.now);
    discount = r.off; couponError = r.error;
  }
  const tax = vendor.gstin ? Math.round(((taxable - Math.min(discount, taxable)) * vendor.gstRate) / 100) : 0;
  const deliveryFee = opts.subscription ? 0 : db.settings.deliveryFee;
  const deposit = newCans * db.settings.canDeposit;
  return {
    vendor, lines, subtotal, tax, deliveryFee, deposit, discount, couponError,
    total: Math.max(0, subtotal - discount + tax + deliveryFee + deposit),
    cansExpected, newCans, driversNearby: ranked.length,
    etaMin: ranked[0] ? Math.round(8 + ranked[0].km * 4) : null,
  };
}

/* ───────── Cancellation ───────── */

export function cancelPolicy(st: Settings, o: Order): { allowed: boolean; fee: number; note: string } {
  const i = stepOf(o.status);
  if (o.status === "Cancelled" || o.status === "Failed Assignment" || i >= stepOf("Delivered")) return { allowed: false, fee: 0, note: "This order can no longer be cancelled." };
  if (i >= stepOf("Arrived")) return { allowed: false, fee: 0, note: "The driver has arrived — please contact support." };
  if (i <= stepOf(st.freeCancelUntil)) return { allowed: true, fee: 0, note: "Free cancellation" };
  return { allowed: true, fee: st.cancelFee, note: `A ${inr(st.cancelFee)} cancellation fee applies now that the driver is on the way.` };
}

/* ───────── Tracking ───────── */

export function driverPos(o: Order, d: Driver | undefined, now: number): Pt | null {
  if (!d) return null;
  if (!o.track || o.status === "Accepted" || o.status === "Pickup") return o.track?.from ?? d.loc;
  if (o.status === "Out for Delivery" && o.track.outAt) {
    const f = (now - o.track.outAt) / o.track.travelMs;
    return alongRoute(route(o.track.from, o.address.pt), Math.min(0.97, f));
  }
  if (["Arrived", ...DONE].includes(o.status)) return o.address.pt;
  return d.loc;
}

export function etaMins(o: Order, now: number) {
  if (!o.track) return null;
  if (o.status === "Out for Delivery" && o.track.outAt) return Math.max(1, Math.ceil((o.track.outAt + o.track.travelMs - now) / 60000 * 4));
  if (o.status === "Accepted" || o.status === "Pickup") return Math.ceil(o.track.travelMs / 60000 * 4) + 5;
  return null;
}

/* ───────── Money ───────── */

export function commissionOf(v: Vendor, o: Order) {
  if (v.monetization.mode === "subscription") return 0;
  return Math.round(((o.subtotal - o.discount) * v.monetization.commissionPct) / 100);
}

export const walletBalance = (db: DB, customerId: string) => db.wallet.filter((w) => w.customerId === customerId).reduce((s, w) => s + w.amount, 0);

export function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  if (!rows.length) return "";
  const heads = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [heads.join(","), ...rows.map((r) => heads.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadCsv(name: string, rows: Record<string, string | number | null | undefined>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
