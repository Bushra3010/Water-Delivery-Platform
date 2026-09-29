/* Demo data. One launch city (Noida) plus an inactive second city to show
 * multi-city readiness. History is generated with a fixed seed relative to
 * "now", so dashboards and reports are computed from real order rows. */

import { DAY, commissionOf } from "./logic";
import type { Address, Customer, CustomerSub, DB, Driver, Order, OrderStatus, PayMethod, Settlement, Vendor, VendorProduct, WalletTxn } from "./types";

export const DB_VERSION = 3;

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "Priya Singh", "Anil Gupta", "Neha Verma", "Rohan Mehta", "Sakshi Jain", "Vikram Rao", "Pooja Nair", "Arjun Kapoor",
  "Meera Iyer", "Karan Malhotra", "Divya Sharma", "Siddharth Bose", "Ananya Das", "Rajesh Kumar", "Kavita Joshi", "Manish Arora",
  "Shruti Saxena", "Aditya Chauhan", "Nisha Pandey", "Gaurav Tiwari", "Ritu Agarwal", "Deepak Mishra", "Sneha Kulkarni", "Varun Bhatia",
  "Tanvi Desai", "Harsh Vardhan", "Payal Thakur", "Nitin Yadav", "Swati Reddy", "Amanpreet Kaur", "Farhan Ali", "Lakshmi Menon",
  "Yash Goyal", "Isha Khanna", "Mohit Sethi", "Bhavna Rawat", "Kunal Shah", "Aarti Dubey", "Sameer Khan",
];

export function seed(now = Date.now()): DB {
  const r = rng(20260930);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const t0 = today.getTime();

  const cities = [
    { id: "noida", name: "Noida", state: "Uttar Pradesh", active: true },
    { id: "gzb", name: "Ghaziabad", state: "Uttar Pradesh", active: false },
    { id: "ggn", name: "Gurugram", state: "Haryana", active: false },
  ];

  const localities = [
    { id: "l12", cityId: "noida", name: "Sector 12", pin: "201301", center: { x: 300, y: 250 } },
    { id: "l15", cityId: "noida", name: "Sector 15", pin: "201301", center: { x: 170, y: 380 } },
    { id: "l18", cityId: "noida", name: "Sector 18", pin: "201301", center: { x: 260, y: 480 } },
    { id: "l22", cityId: "noida", name: "Sector 22", pin: "201301", center: { x: 440, y: 330 } },
    { id: "l27", cityId: "noida", name: "Sector 27", pin: "201301", center: { x: 330, y: 590 } },
    { id: "l44", cityId: "noida", name: "Sector 44", pin: "201303", center: { x: 400, y: 740 } },
    { id: "l50", cityId: "noida", name: "Sector 50", pin: "201303", center: { x: 580, y: 700 } },
    { id: "l62", cityId: "noida", name: "Sector 62", pin: "201309", center: { x: 740, y: 280 } },
    { id: "l63", cityId: "noida", name: "Sector 63", pin: "201307", center: { x: 640, y: 150 } },
    { id: "l76", cityId: "noida", name: "Sector 76", pin: "201304", center: { x: 740, y: 560 } },
    { id: "l137", cityId: "noida", name: "Sector 137", pin: "201305", center: { x: 880, y: 880 } },
    { id: "lind", cityId: "gzb", name: "Indirapuram", pin: "201014", center: { x: 0, y: 0 } },
    { id: "lvai", cityId: "gzb", name: "Vaishali", pin: "201010", center: { x: 0, y: 0 } },
  ];

  const docs = (ok: boolean) => [
    { name: "GST certificate", status: ok ? "Verified" as const : "Pending" as const },
    { name: "FSSAI licence", status: ok ? "Verified" as const : "Pending" as const },
    { name: "Owner PAN", status: "Verified" as const },
    { name: "Water quality report", status: ok ? "Verified" as const : "Missing" as const },
  ];

  const vendors: Vendor[] = [
    {
      id: "v1", name: "Green Water Supplies", owner: "Harish Chandra", phone: "9810012345", email: "green@watersupply.in",
      cityId: "noida", address: "Plot 14, Sector 12, Noida", location: { x: 310, y: 240 },
      status: "Active", kyc: "Verified", docs: docs(true), gstin: "09AABCG1234K1Z5", gstRate: 18,
      planId: "vp2", planExpiry: t0 + 18 * DAY, monetization: { mode: "both", commissionPct: 5 }, paymentMode: "platform",
      area: { rule: "any", radiusKm: 3.5, pins: ["201301"], localities: [], polygon: null }, joinedAt: t0 - 210 * DAY,
    },
    {
      id: "v2", name: "PureLife Water", owner: "Sunita Arora", phone: "9811122334", email: "orders@purelife.in",
      cityId: "noida", address: "B-7, Sector 62, Noida", location: { x: 730, y: 270 },
      status: "Active", kyc: "Verified", docs: docs(true), gstin: "09AAFCP5678L1Z2", gstRate: 18,
      planId: null, planExpiry: 0, monetization: { mode: "commission", commissionPct: 8 }, paymentMode: "direct",
      area: { rule: "any", radiusKm: null, pins: [], localities: [], polygon: [{ x: 560, y: 60 }, { x: 920, y: 60 }, { x: 920, y: 470 }, { x: 600, y: 480 }] },
      joinedAt: t0 - 150 * DAY,
    },
    {
      id: "v3", name: "Fresh Aqua", owner: "Mohd. Imran", phone: "9899012312", email: "freshaqua@gmail.com",
      cityId: "noida", address: "C-21, Sector 15, Noida", location: { x: 180, y: 370 },
      status: "Pending", kyc: "Pending", docs: docs(false), gstin: null, gstRate: 0,
      planId: "vp1", planExpiry: t0 + 30 * DAY, monetization: { mode: "subscription", commissionPct: 0 }, paymentMode: "platform",
      area: { rule: "any", radiusKm: 2.5, pins: [], localities: [], polygon: null }, joinedAt: t0 - 3 * DAY,
    },
    {
      id: "v4", name: "Blue Drop", owner: "Ramesh Tyagi", phone: "9873344556", email: "bluedrop@water.in",
      cityId: "noida", address: "Shop 3, Sector 18 Market, Noida", location: { x: 270, y: 480 },
      status: "Active", kyc: "Verified", docs: docs(true), gstin: "09AAKFB9012M1Z8", gstRate: 18,
      planId: "vp1", planExpiry: t0 + 9 * DAY, monetization: { mode: "subscription", commissionPct: 0 }, paymentMode: "platform",
      area: { rule: "any", radiusKm: 2, pins: [], localities: ["l15", "l18", "l27", "l44", "l50"], polygon: null }, joinedAt: t0 - 120 * DAY,
    },
    {
      id: "v5", name: "Aqua Fresh", owner: "Pankaj Bhati", phone: "9876501234", email: "aquafresh22@gmail.com",
      cityId: "noida", address: "D-90, Sector 22, Noida", location: { x: 450, y: 320 },
      status: "Blocked", kyc: "Rejected", docs: docs(false), gstin: null, gstRate: 0,
      planId: null, planExpiry: 0, monetization: { mode: "commission", commissionPct: 10 }, paymentMode: "platform",
      area: { rule: "any", radiusKm: 2, pins: [], localities: [], polygon: null }, joinedAt: t0 - 90 * DAY,
    },
    {
      id: "v6", name: "Neer Jal Services", owner: "Kamlesh Nagar", phone: "9958877665", email: "neerjal@water.in",
      cityId: "noida", address: "A-12, Sector 50, Noida", location: { x: 570, y: 690 },
      status: "Active", kyc: "Verified", docs: docs(true), gstin: null, gstRate: 0,
      planId: "vp1", planExpiry: t0 - 10 * DAY, monetization: { mode: "subscription", commissionPct: 0 }, paymentMode: "platform",
      area: { rule: "any", radiusKm: 3, pins: [], localities: [], polygon: null }, joinedAt: t0 - 75 * DAY,
    },
  ];

  const drivers: Driver[] = [
    { id: "d1", vendorId: "v1", name: "Amit Kumar", phone: "9876512340", status: "Active", kyc: "Verified", licence: "DL-0420190012345", idProof: "Aadhaar ••••4521", online: true, loc: { x: 335, y: 300 }, vehicleId: "vh1", joinedAt: t0 - 200 * DAY },
    { id: "d2", vendorId: "v1", name: "Suresh Yadav", phone: "9876512341", status: "Active", kyc: "Verified", licence: "UP16-2018-0045678", idProof: "Aadhaar ••••7788", online: true, loc: { x: 420, y: 305 }, vehicleId: "vh2", joinedAt: t0 - 180 * DAY },
    { id: "d3", vendorId: "v1", name: "Ravi Verma", phone: "9876512342", status: "Active", kyc: "Verified", licence: "UP16-2020-0011223", idProof: "Aadhaar ••••9012", online: false, loc: { x: 250, y: 200 }, vehicleId: "vh3", joinedAt: t0 - 95 * DAY },
    { id: "d4", vendorId: "v1", name: "Manoj Pal", phone: "9876512343", status: "Pending", kyc: "Pending", licence: "UP16-2024-0099887", idProof: "Aadhaar ••••3344", online: false, loc: { x: 310, y: 240 }, vehicleId: null, joinedAt: t0 - 2 * DAY },
    { id: "d5", vendorId: "v2", name: "Deepak Singh", phone: "9811100221", status: "Active", kyc: "Verified", licence: "UP16-2017-0034567", idProof: "Aadhaar ••••1122", online: true, loc: { x: 700, y: 230 }, vehicleId: "vh4", joinedAt: t0 - 140 * DAY },
    { id: "d6", vendorId: "v2", name: "Vikas Chauhan", phone: "9811100222", status: "Active", kyc: "Verified", licence: "UP16-2019-0076543", idProof: "Aadhaar ••••5566", online: true, loc: { x: 690, y: 330 }, vehicleId: "vh5", joinedAt: t0 - 130 * DAY },
    { id: "d7", vendorId: "v4", name: "Rohit Sharma", phone: "9873300111", status: "Active", kyc: "Verified", licence: "DL-0720180054321", idProof: "Aadhaar ••••6677", online: true, loc: { x: 285, y: 520 }, vehicleId: "vh6", joinedAt: t0 - 110 * DAY },
    { id: "d8", vendorId: "v4", name: "Sunil Bhati", phone: "9873300112", status: "Suspended", kyc: "Verified", licence: "UP16-2016-0012121", idProof: "Aadhaar ••••8899", online: false, loc: { x: 330, y: 600 }, vehicleId: null, joinedAt: t0 - 100 * DAY },
    { id: "d9", vendorId: "v6", name: "Jitender Nagar", phone: "9958800123", status: "Active", kyc: "Verified", licence: "UP16-2015-0067676", idProof: "Aadhaar ••••2233", online: true, loc: { x: 600, y: 660 }, vehicleId: "vh7", joinedAt: t0 - 70 * DAY },
  ];

  const vehicles = [
    { id: "vh1", vendorId: "v1", number: "UP16 ER 4521", type: "E-Rickshaw" as const, capacity: 24, status: "Active" as const, driverId: "d1" },
    { id: "vh2", vendorId: "v1", number: "UP16 CT 7788", type: "Tempo" as const, capacity: 60, status: "Active" as const, driverId: "d2" },
    { id: "vh3", vendorId: "v1", number: "UP16 ER 9012", type: "E-Rickshaw" as const, capacity: 24, status: "Maintenance" as const, driverId: "d3" },
    { id: "vh4", vendorId: "v2", number: "UP16 PV 1122", type: "Pickup Van" as const, capacity: 80, status: "Active" as const, driverId: "d5" },
    { id: "vh5", vendorId: "v2", number: "UP16 ER 5566", type: "E-Rickshaw" as const, capacity: 24, status: "Active" as const, driverId: "d6" },
    { id: "vh6", vendorId: "v4", number: "DL7C AB 6677", type: "Tempo" as const, capacity: 50, status: "Active" as const, driverId: "d7" },
    { id: "vh7", vendorId: "v6", number: "UP16 ER 2233", type: "E-Rickshaw" as const, capacity: 24, status: "Active" as const, driverId: "d9" },
  ];

  const skus = [
    { id: "s20", name: "20L Water Can", size: "20 L", art: "can20" as const, desc: "RO + UV purified water in a reusable food-grade can.", returnable: true },
    { id: "s10", name: "10L Water Can", size: "10 L", art: "can10" as const, desc: "Handy half-size reusable can for small families.", returnable: true },
    { id: "sbis", name: "Bisleri 20L Jar", size: "20 L", art: "jar" as const, desc: "Branded packaged drinking water jar.", returnable: true },
    { id: "s1l", name: "1L Bottles (Pack of 12)", size: "12 × 1 L", art: "carton" as const, desc: "Sealed 1-litre bottles — no can return needed.", returnable: false },
    { id: "s500", name: "500ml Bottles (Pack of 24)", size: "24 × 500 ml", art: "bottle" as const, desc: "Party & office pack of sealed half-litre bottles.", returnable: false },
  ];

  const priceRules = [
    { skuId: "s20", min: 80, max: 140 }, { skuId: "s10", min: 50, max: 90 }, { skuId: "sbis", min: 100, max: 160 },
    { skuId: "s1l", min: 120, max: 220 }, { skuId: "s500", min: 150, max: 260 },
  ];

  const prices: Record<string, Record<string, number>> = {
    v1: { s20: 120, s10: 70, sbis: 130, s1l: 180, s500: 220 },
    v2: { s20: 110, s10: 65, sbis: 125, s1l: 170 },
    v3: { s20: 90, s10: 55 },
    v4: { s20: 100, s10: 60, sbis: 120, s500: 210 },
    v5: { s20: 85 },
    v6: { s20: 95, s10: 60 },
  };
  const products: VendorProduct[] = [];
  Object.entries(prices).forEach(([vendorId, ps]) => Object.entries(ps).forEach(([skuId, price]) => {
    products.push({
      id: `p_${vendorId}_${skuId}`, vendorId, skuId, price, active: true, inStock: !(vendorId === "v1" && skuId === "s500"), taxable: !!vendors.find((v) => v.id === vendorId)!.gstin,
      history: [{ at: t0 - 60 * DAY, price: price - 10, by: "Vendor" }, { at: t0 - 20 * DAY, price, by: "Vendor" }],
    });
  }));

  /* ── Customers ── */
  const customers: Customer[] = [{ id: "c1", name: "Rahul Sharma", phone: "9876543210", lang: "en", status: "Active", cansHeld: 2, joinedAt: t0 - 160 * DAY }];
  const addresses: Address[] = [
    { id: "a1", customerId: "c1", label: "Home", line: "B-45, Sector 12", landmark: "Near Shiv Mandir", localityId: "l12", pin: "201301", pt: { x: 290, y: 262 }, isDefault: true },
    { id: "a2", customerId: "c1", label: "Office", line: "C-23, Sector 63 IT Park", landmark: "Tower B, 4th floor", localityId: "l63", pin: "201307", pt: { x: 650, y: 160 }, isDefault: false },
  ];
  const served = localities.filter((l) => ["l12", "l15", "l18", "l22", "l27", "l44", "l62", "l63"].includes(l.id));
  NAMES.forEach((name, i) => {
    const id = `c${i + 2}`;
    const loc = served[i % served.length];
    customers.push({ id, name, phone: `98${String(10000000 + Math.floor(r() * 89999999))}`, lang: r() < 0.3 ? "hi" : "en", status: i === 17 ? "Blocked" : "Active", cansHeld: 1 + Math.floor(r() * 3), joinedAt: t0 - Math.floor(10 + r() * 180) * DAY });
    addresses.push({
      id: `a${i + 3}`, customerId: id, label: "Home", line: `${String.fromCharCode(65 + (i % 6))}-${10 + i * 3}, ${loc.name}`, landmark: "",
      localityId: loc.id, pin: loc.pin, pt: { x: loc.center.x + Math.round(r() * 60 - 30), y: loc.center.y + Math.round(r() * 60 - 30) }, isDefault: true,
    });
  });

  /* ── Historical orders (last 30 days) ── */
  const orders: Order[] = [];
  let seq = 12200;
  const vendorDrivers: Record<string, string[]> = { v1: ["d1", "d2", "d3"], v2: ["d5", "d6"], v4: ["d7", "d8"], v6: ["d9"] };
  const vendorSkus: Record<string, string[]> = { v1: ["s20", "s20", "s20", "s10", "sbis", "s1l"], v2: ["s20", "s20", "sbis", "s1l", "s10"], v4: ["s20", "s20", "sbis", "s10", "s500"], v6: ["s20", "s10"] };
  const TAGS = ["On time", "Polite driver", "Clean can", "Sealed cap", "Good taste"];

  for (let day = 29; day >= 0; day--) {
    const n = 7 + Math.floor(r() * 7) + (day % 7 === 0 ? 4 : 0);
    for (let k = 0; k < n; k++) {
      const vendorId = pick(day > 10 ? ["v1", "v1", "v2", "v4", "v6"] : ["v1", "v1", "v2", "v4", "v4"]);
      const v = vendors.find((x) => x.id === vendorId)!;
      const c = customers[1 + Math.floor(r() * (customers.length - 1))];
      const a = addresses.find((x) => x.customerId === c.id)!;
      const skuId = pick(vendorSkus[vendorId]);
      const sku = skus.find((s) => s.id === skuId)!;
      const qty = sku.returnable ? 1 + Math.floor(r() * 3) : 1;
      const price = prices[vendorId][skuId];
      const created = t0 - day * DAY + Math.floor((7 + r() * 13) * 3600000);
      if (created > now - 20 * 60000) continue;
      const roll = r();
      const status: OrderStatus = roll < 0.06 ? "Cancelled" : roll < 0.085 ? "Failed Assignment" : "Completed";
      const method: PayMethod = pick(["COD", "COD", "UPI", "UPI", "Wallet"]);
      const subtotal = price * qty;
      const tax = v.gstin ? Math.round((subtotal * v.gstRate) / 100) : 0;
      const total = subtotal + tax + 10;
      const driverId = status === "Failed Assignment" ? null : pick(vendorDrivers[vendorId]);
      const id = `WD${++seq}`;
      const acceptAt = created + 60000 + Math.floor(r() * 90000);
      const doneAt = acceptAt + Math.floor((14 + r() * 26) * 60000);
      const timeline: Order["timeline"] = [{ status: "Placed", at: created }, { status: "Searching", at: created + 2000 }];
      if (status === "Completed") {
        timeline.push({ status: "Accepted", at: acceptAt }, { status: "Out for Delivery", at: acceptAt + 5 * 60000 }, { status: "Arrived", at: doneAt - 3 * 60000 },
          { status: "Delivered", at: doneAt - 60000 }, { status: "Payment Confirmed", at: doneAt - 30000 }, { status: "Completed", at: doneAt });
      } else if (status === "Cancelled") timeline.push({ status: "Cancelled", at: created + 4 * 60000, by: "Customer" });
      else timeline.push({ status: "Failed Assignment", at: created + 3 * 60000 });
      const rated = status === "Completed" && r() < 0.55;
      const stars = () => (r() < 0.12 ? 3 : r() < 0.4 ? 4 : 5);
      const ord: Order = {
        id, customerId: c.id, createdAt: created,
        address: { label: a.label, line: a.line, pin: a.pin, localityId: a.localityId, pt: a.pt },
        items: [{ skuId, name: sku.name, qty, price }], subtotal, tax, deliveryFee: 10, deposit: 0, discount: 0, coupon: null, total,
        payment: {
          method, routing: v.paymentMode, ref: method === "UPI" ? `UPI${Math.floor(r() * 1e10)}` : null,
          status: status === "Completed" ? (method === "COD" ? "Collected" : "Paid") : status === "Cancelled" && method !== "COD" ? "Refunded" : method === "COD" ? "Pending" : "Refunded",
        },
        type: r() < 0.2 ? "Scheduled" : "Immediate", slot: null, subscriptionId: null,
        status, vendorId: status === "Failed Assignment" ? null : vendorId, driverId,
        attempts: status === "Failed Assignment"
          ? [{ driverId: pick(vendorDrivers[vendorId]), vendorId, distKm: 1.4, at: created + 3000, result: "Timeout" }]
          : driverId ? [{ driverId, vendorId, distKm: Math.round(r() * 30 + 5) / 10, at: created + 3000, result: "Accepted" }] : [],
        offer: null, timeline,
        track: status === "Completed" ? { from: v.location, outAt: acceptAt + 5 * 60000, travelMs: 600000 } : null,
        otp: String(1000 + Math.floor(r() * 9000)), proofPhoto: status === "Completed" && r() < 0.4,
        cans: { expected: sku.returnable ? qty : 0, returned: status === "Completed" ? (sku.returnable ? qty - (r() < 0.08 ? 1 : 0) : 0) : null, note: null },
        rating: rated ? { driver: stars(), vendor: stars(), product: stars(), comment: r() < 0.3 ? pick(["Very quick delivery!", "Water tastes fresh.", "Driver was late by 10 minutes.", "Good service as always."]) : "", tags: [pick(TAGS)] } : null,
        cancel: status === "Cancelled" ? { by: "Customer", reason: pick(["Ordered by mistake", "Delivery taking too long", "Changed my mind"]), fee: 0 } : null,
        invoiceNo: status === "Completed" ? `INV-${vendorId.toUpperCase()}-${seq}` : null,
      };
      if (ord.cans.returned !== null && ord.cans.returned < ord.cans.expected) ord.cans.note = "Customer kept 1 can — added to can balance";
      orders.push(ord);
    }
  }

  // Rahul's own recent history.
  const past = (days: number, h: number) => t0 - days * DAY + h * 3600000;
  const mine = (id: string, at: number, qty: number, method: PayMethod, rating: boolean): Order => {
    const subtotal = 120 * qty, tax = Math.round(subtotal * 0.18);
    return {
      id, customerId: "c1", createdAt: at, address: { label: "Home", line: "B-45, Sector 12", pin: "201301", localityId: "l12", pt: { x: 290, y: 262 } },
      items: [{ skuId: "s20", name: "20L Water Can", qty, price: 120 }], subtotal, tax, deliveryFee: 10, deposit: 0, discount: 0, coupon: null, total: subtotal + tax + 10,
      payment: { method, status: method === "COD" ? "Collected" : "Paid", routing: "platform", ref: method === "UPI" ? "UPI4471902211" : null },
      type: "Immediate", slot: null, subscriptionId: null, status: "Completed", vendorId: "v1", driverId: "d1",
      attempts: [{ driverId: "d1", vendorId: "v1", distKm: 0.6, at: at + 3000, result: "Accepted" }], offer: null,
      timeline: [{ status: "Placed", at }, { status: "Searching", at: at + 2000 }, { status: "Accepted", at: at + 70000 }, { status: "Out for Delivery", at: at + 360000 },
        { status: "Arrived", at: at + 1200000 }, { status: "Delivered", at: at + 1300000 }, { status: "Payment Confirmed", at: at + 1320000 }, { status: "Completed", at: at + 1330000 }],
      track: { from: { x: 310, y: 240 }, outAt: at + 360000, travelMs: 600000 }, otp: "4821", proofPhoto: true,
      cans: { expected: qty, returned: qty, note: null },
      rating: rating ? { driver: 5, vendor: 4, product: 5, comment: "Always on time.", tags: ["On time", "Clean can"] } : null,
      cancel: null, invoiceNo: `INV-V1-${id.slice(2)}`,
    };
  };
  orders.push(mine("WD12190", past(12, 9.5), 2, "UPI", true), mine("WD12195", past(5, 18.2), 1, "COD", false), mine("WD12198", past(2, 8.4), 2, "Wallet", true));

  // A scheduled subscription delivery that is still in the future.
  orders.push({
    ...mine("WD12199", now - 3600000, 1, "COD", false),
    items: [{ skuId: "s20", name: "20L Water Can", qty: 1, price: 0 }], subtotal: 0, tax: 0, deliveryFee: 0, total: 0,
    payment: { method: "Subscription", status: "Covered", routing: "platform", ref: null },
    type: "Scheduled", slot: { date: t0 + 2 * DAY + 7 * 3600000, window: "7–9 AM" }, subscriptionId: "cs1",
    status: "Placed", vendorId: null, driverId: null, attempts: [], timeline: [{ status: "Placed", at: now - 3600000 }], track: null, proofPhoto: false,
    cans: { expected: 1, returned: null, note: null }, rating: null, invoiceNo: null, otp: "7302",
  });
  orders.sort((a, b) => b.createdAt - a.createdAt);

  /* ── Subscriptions ── */
  const plans = [
    { id: "pl1", owner: "platform", name: "Monthly Plan", desc: "4 × 20L cans a month. Order any time or set a weekly delivery.", skuId: "s20", price: 480, validityDays: 30, entitlement: 4, mode: "Both" as const, maxPerDay: 2, unused: "Carry forward" as const, autoRenew: true, active: true },
    { id: "pl2", owner: "platform", name: "Family Plan", desc: "15 × 20L cans — best for families of 4–6.", skuId: "s20", price: 1650, validityDays: 30, entitlement: 15, mode: "Both" as const, maxPerDay: 2, unused: "Expire" as const, autoRenew: true, active: true },
    { id: "pl3", owner: "v1", name: "One Can a Day", desc: "A fresh 20L can every morning from Green Water Supplies.", skuId: "s20", price: 3000, validityDays: 30, entitlement: 30, mode: "Scheduled" as const, maxPerDay: 1, unused: "Expire" as const, autoRenew: true, active: true },
    { id: "pl4", owner: "v2", name: "Office Pack", desc: "20 Bisleri jars a month, delivered on demand.", skuId: "sbis", price: 2400, validityDays: 30, entitlement: 20, mode: "On-demand" as const, maxPerDay: null, unused: "Carry forward" as const, autoRenew: false, active: true },
    { id: "pl5", owner: "v4", name: "Weekend Saver", desc: "8 × 20L cans, weekend deliveries.", skuId: "s20", price: 760, validityDays: 30, entitlement: 8, mode: "Scheduled" as const, maxPerDay: 1, unused: "Expire" as const, autoRenew: true, active: false },
  ];
  const subs: CustomerSub[] = [
    {
      id: "cs1", customerId: "c1", planId: "pl1", start: t0 - 5 * DAY, end: t0 + 25 * DAY, used: 2, carried: 0, autoRenew: true, status: "Active" as const,
      schedule: { every: "Weekly" as const, qty: 1, window: "7–9 AM" },
      ledger: [{ at: t0 - 5 * DAY, delta: 4, note: "Plan activated" }, { at: t0 - 2 * DAY, delta: -1, note: "Delivered", orderId: "WD12198" }, { at: now - 3600000, delta: -1, note: "Scheduled delivery booked", orderId: "WD12199" }],
    },
  ];
  customers.slice(1, 29).forEach((c, i) => {
    const plan = plans[i % 4];
    const start = t0 - Math.floor(r() * 28) * DAY;
    const used = Math.floor(r() * plan.entitlement * 0.8);
    subs.push({
      id: `cs${i + 2}`, customerId: c.id, planId: plan.id, start, end: start + plan.validityDays * DAY, used, carried: 0,
      autoRenew: r() < 0.6, status: (i % 9 === 8 ? "Expired" : "Active") as "Active",
      schedule: plan.mode === "Scheduled" ? { every: "Daily", qty: 1, window: "7–9 AM" } : null,
      ledger: [{ at: start, delta: plan.entitlement, note: "Plan activated" }, ...(used ? [{ at: start + DAY, delta: -used, note: `${used} deliveries` }] : [])],
    });
  });

  const vendorPlans = [
    { id: "vp1", name: "Starter", fee: 999, days: 30, perks: "Up to 3 drivers · standard listing" },
    { id: "vp2", name: "Growth", fee: 2499, days: 30, perks: "Up to 10 drivers · vendor subscription plans" },
    { id: "vp3", name: "Pro", fee: 4999, days: 30, perks: "Unlimited drivers · priority support · reports export" },
  ];

  /* ── Wallet ── */
  const wallet: WalletTxn[] = [
    { id: "w1", customerId: "c1", amount: 500, title: "Added money · UPI", at: t0 - 20 * DAY, ref: "UPI8812003311" },
    { id: "w2", customerId: "c1", amount: 50, title: "Cashback · WATER50", at: t0 - 12 * DAY },
    { id: "w3", customerId: "c1", amount: -293, title: "Paid for order #WD12198", at: t0 - 2 * DAY + 8.4 * 3600000, ref: "WD12198" },
    { id: "w4", customerId: "c1", amount: 25, title: "Refund · late delivery goodwill", at: t0 - DAY, ref: "Admin" },
  ];
  customers.slice(1).forEach((c, i) => { if (i % 3 === 0) wallet.push({ id: `wx${i}`, customerId: c.id, amount: 200 + (i % 4) * 100, title: "Added money · UPI", at: t0 - (i % 20) * DAY }); });

  const coupons = [
    { code: "WATER50", desc: "Flat ₹50 off on orders above ₹200", kind: "flat" as const, value: 50, maxOff: null, minOrder: 200, limit: 5000, used: 1284, perUser: 3, active: true, validTill: t0 + 60 * DAY },
    { code: "FIRST20", desc: "20% off your first order (up to ₹60)", kind: "pct" as const, value: 20, maxOff: 60, minOrder: 0, limit: 10000, used: 3120, perUser: 1, active: true, validTill: t0 + 120 * DAY },
    { code: "BULK100", desc: "₹100 off on orders above ₹600", kind: "flat" as const, value: 100, maxOff: null, minOrder: 600, limit: 1000, used: 212, perUser: 5, active: true, validTill: t0 + 30 * DAY },
    { code: "MONSOON15", desc: "15% off monsoon special", kind: "pct" as const, value: 15, maxOff: 75, minOrder: 150, limit: 2000, used: 2000, perUser: 2, active: false, validTill: t0 - 5 * DAY },
  ];

  /* ── Settlements (platform-collected vendors, weekly) ── */
  const settlements: Settlement[] = [];
  ["v1", "v4", "v6"].forEach((vid) => {
    const v = vendors.find((x) => x.id === vid)!;
    [3, 2, 1].forEach((w, i) => {
      const from = t0 - w * 7 * DAY, to = from + 7 * DAY;
      const os = orders.filter((o) => o.vendorId === vid && o.status === "Completed" && o.createdAt >= from && o.createdAt < to);
      const online = os.filter((o) => o.payment.method !== "COD").reduce((s, o) => s + o.total, 0);
      const commission = os.reduce((s, o) => s + commissionOf(v, o), 0);
      const status = i === 0 ? "Paid" : i === 1 ? "Approved" : "Pending Review";
      settlements.push({
        id: `ST-${vid.toUpperCase()}-${w}`, vendorId: vid, period: `${new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(to - DAY).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        orders: os.length, gross: online, commission, fee: 0, net: online - commission, status,
        approvedBy: status === "Pending Review" ? null : "Arjun Nair (Finance)", at: to + DAY, ref: status === "Paid" ? `NEFT${900000 + w * 1311}` : null,
      });
    });
  });

  const roles = [
    { id: "super", name: "Super Admin", readOnly: false, desc: "Full platform control", sections: ["dashboard", "vendors", "customers", "drivers", "orders", "pricing", "monetization", "plans", "payments", "settlements", "coupons", "ads", "cities", "reports", "rbac", "audit", "settings"] as const },
    { id: "ops", name: "Operations Manager", readOnly: false, desc: "Orders, dispatch exceptions, service areas and field activity", sections: ["dashboard", "orders", "drivers", "vendors", "cities", "reports"] as const },
    { id: "vm", name: "Vendor Manager", readOnly: false, desc: "Vendor onboarding, KYC, subscriptions and account status", sections: ["dashboard", "vendors", "drivers", "monetization", "pricing"] as const },
    { id: "fin", name: "Finance / Accounts", readOnly: false, desc: "Payments, wallet, commissions and settlements", sections: ["dashboard", "payments", "settlements", "monetization", "reports"] as const },
    { id: "cs", name: "Customer Support", readOnly: false, desc: "Customer & order lookup, cancellations, complaints", sections: ["dashboard", "customers", "orders"] as const },
    { id: "aud", name: "Read-only Auditor", readOnly: true, desc: "Read-only reports, transactions and audit trail", sections: ["dashboard", "orders", "payments", "settlements", "reports", "audit"] as const },
  ].map((x) => ({ ...x, sections: [...x.sections] }));

  const staff = [
    { id: "st1", name: "Priya Mehta", email: "admin@aquaadmin.in", roleId: "super", active: true },
    { id: "st2", name: "Karan Oberoi", email: "ops@aquaadmin.in", roleId: "ops", active: true },
    { id: "st3", name: "Neha Kapoor", email: "vendors@aquaadmin.in", roleId: "vm", active: true },
    { id: "st4", name: "Arjun Nair", email: "finance@aquaadmin.in", roleId: "fin", active: true },
    { id: "st5", name: "Sana Qureshi", email: "support@aquaadmin.in", roleId: "cs", active: true },
    { id: "st6", name: "Vivek Rana", email: "audit@aquaadmin.in", roleId: "aud", active: true },
  ];

  const audit = [
    { id: "au1", at: t0 - 6 * DAY + 11 * 3600000, actor: "Arjun Nair", role: "Finance / Accounts", action: "Settlement approved", target: "ST-V1-2", detail: "Net payable approved for Green Water Supplies" },
    { id: "au2", at: t0 - 5 * DAY + 15 * 3600000, actor: "Neha Kapoor", role: "Vendor Manager", action: "Vendor status changed", target: "Aqua Fresh", detail: "Active → Blocked (repeated quality complaints)" },
    { id: "au3", at: t0 - 4 * DAY + 10 * 3600000, actor: "Priya Mehta", role: "Super Admin", action: "Pricing rule changed", target: "20L Water Can", detail: "Range ₹70–₹130 → ₹80–₹140" },
    { id: "au4", at: t0 - 3 * DAY + 12 * 3600000, actor: "Harish Chandra", role: "Vendor Admin", action: "Price updated", target: "Green Water Supplies · 20L Water Can", detail: "₹110 → ₹120" },
    { id: "au5", at: t0 - 2 * DAY + 17 * 3600000, actor: "Karan Oberoi", role: "Operations Manager", action: "Dispatch retried", target: "WD12230", detail: "Manual retry after failed assignment" },
    { id: "au6", at: t0 - DAY + 9 * 3600000, actor: "Priya Mehta", role: "Super Admin", action: "Settings changed", target: "Dispatch", detail: "Driver response timeout 30s → 20s" },
    { id: "au7", at: t0 - DAY + 13 * 3600000, actor: "Sana Qureshi", role: "Customer Support", action: "Wallet credit", target: "Rahul Sharma", detail: "₹25 goodwill credit for late delivery" },
  ];

  const notices = [
    { id: "n1", to: "customer:c1", title: "Subscription renewal in 25 days", body: "Your Monthly Plan renews automatically on " + new Date(t0 + 25 * DAY).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ".", at: t0 - 3600000, read: false },
    { id: "n2", to: "customer:c1", title: "Order delivered", body: "2 × 20L Water Can delivered by Amit Kumar. Rate your delivery!", at: t0 - 2 * DAY + 9 * 3600000, read: true, orderId: "WD12198" },
    { id: "n3", to: "vendor:v1", title: "Driver KYC submitted", body: "Manoj Pal's documents are awaiting verification.", at: t0 - 2 * DAY, read: false },
    { id: "n4", to: "vendor:v1", title: "Platform plan renews in 18 days", body: "Growth plan · ₹2,499", at: t0 - DAY, read: true },
  ];

  const settings = {
    dispatchTimeoutSec: 20, maxAttempts: 5, searchRadiusKm: 5,
    freeCancelUntil: "Accepted" as const, cancelFee: 20, deliveryFee: 10, canDeposit: 150,
    payModes: { cod: true, upi: true, wallet: true }, defaultRouting: "platform" as const,
    vendorExpiry: "Grace period (7 days)" as const,
    languages: [
      { code: "en", name: "English", enabled: true }, { code: "hi", name: "हिन्दी", enabled: true },
      { code: "pa", name: "ਪੰਜਾਬੀ", enabled: false }, { code: "mr", name: "मराठी", enabled: false },
    ],
    ads: { enabled: true, homeBanner: true, ordersNative: true, interstitial: false, unitId: "ca-app-pub-0000000000000000/0000000000" },
    notify: { renewalDaysBefore: 3, scheduledReminderMins: 60 },
    support: { phone: "18001203040", whatsapp: "919876500000" },
    slots: ["7–9 AM", "9–11 AM", "11 AM–1 PM", "4–6 PM", "6–8 PM"],
  };

  return {
    version: DB_VERSION, cities, localities, vendors, drivers, vehicles, customers, addresses, skus, priceRules, products,
    orders, plans, subs, vendorPlans, wallet, coupons, settlements, roles, staff, audit, notices, settings, seq: 12300,
  };
}

