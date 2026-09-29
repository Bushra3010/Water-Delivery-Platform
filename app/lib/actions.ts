"use client";

/* Order lifecycle + automatic dispatch. Every function mutates the draft DB
 * handed to it by `update()`. In production this is the backend's job
 * (Supabase edge function + cron); in the demo every open tab runs `tick()`
 * and the store's re-read-before-write keeps them consistent. */

import { useEffect } from "react";
import {
  DONE, FINDING, LIVE, cancelPolicy, distKm, fmtDT, inr, orderSpot, rankDrivers, walletBalance,
} from "./logic";
import { getDB, session, update } from "./store";
import type { DB, Order, OrderStatus, PayMethod, Rating } from "./types";

/* ───────── Helpers ───────── */

export function notify(d: DB, to: string, title: string, body: string, orderId?: string) {
  d.notices.unshift({ id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, to, title, body, at: Date.now(), read: false, orderId });
  if (d.notices.length > 300) d.notices.length = 300;
}

export function audit(d: DB, actor: string, role: string, action: string, target: string, detail: string) {
  d.audit.unshift({ id: `au${Date.now()}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), actor, role, action, target, detail });
}

const stamp = (o: Order, status: OrderStatus, now: number, by?: string) => {
  o.status = status;
  o.timeline.push({ status, at: now, ...(by ? { by } : {}) });
};

const nameOf = (d: DB, driverId: string) => d.drivers.find((x) => x.id === driverId)?.name ?? "Driver";
const skuIds = (o: Order) => o.items.map((i) => i.skuId);

/** A vendor-owned subscription plan pins dispatch to that vendor. */
function planVendor(d: DB, o: Order) {
  if (!o.subscriptionId) return null;
  const sub = d.subs.find((s) => s.id === o.subscriptionId);
  const plan = d.plans.find((p) => p.id === sub?.planId);
  return plan && plan.owner !== "platform" ? plan.owner : null;
}

/** Drivers controlled by a person in the Driver app (everyone else is simulated). */
function humanDrivers() {
  return new Set(["d1", session.get("driver") ?? ""]);
}

/* ───────── Dispatch ───────── */

function refundOnFailure(d: DB, o: Order) {
  if (o.payment.method === "UPI" || o.payment.method === "Wallet") o.payment.status = "Refund Pending";
  if (o.payment.method === "Subscription") restoreEntitlement(d, o, "Returned — no driver found");
}

export function offerNext(d: DB, o: Order, now: number) {
  const round = o.attempts.slice(o.roundStart ?? 0);
  const exclude = round.map((a) => a.driverId);
  const [best] = round.length >= d.settings.maxAttempts ? [] : rankDrivers(d, orderSpot(o), skuIds(o), now, { exclude, onlyVendor: planVendor(d, o) });
  if (!best) {
    o.offer = null;
    stamp(o, "Failed Assignment", now);
    refundOnFailure(d, o);
    notify(d, `customer:${o.customerId}`, "No driver available right now", `We couldn't find a driver for #${o.id}. ${o.payment.status === "Refund Pending" ? "Your refund is being processed." : "Please try again in a few minutes."}`, o.id);
    notify(d, "admin", "Failed assignment", `#${o.id} · ${o.address.line} — ${round.length} driver(s) tried.`, o.id);
    const vids = new Set(round.map((a) => a.vendorId));
    vids.forEach((v) => notify(d, `vendor:${v}`, "Failed assignment", `#${o.id} could not be assigned to any of your drivers.`, o.id));
    return;
  }
  o.attempts.push({ driverId: best.driver.id, vendorId: best.vendor.id, distKm: Math.round(best.km * 10) / 10, at: now, result: "Offered" });
  o.offer = { driverId: best.driver.id, at: now, until: now + d.settings.dispatchTimeoutSec * 1000 };
  stamp(o, "Assigned", now, best.driver.name);
  notify(d, `driver:${best.driver.id}`, "New delivery request", `${o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")} · ${best.km.toFixed(1)} km away`, o.id);
}

function closeAttempt(o: Order, result: "Accepted" | "Rejected" | "Timeout" | "Withdrawn") {
  const a = [...o.attempts].reverse().find((x) => x.result === "Offered");
  if (a) a.result = result;
}

/** Returns false if the order was no longer offered to this driver (prevents double acceptance). */
export function acceptOffer(d: DB, o: Order, driverId: string, now: number) {
  if (o.status !== "Assigned" || o.offer?.driverId !== driverId || now > o.offer.until + 1500) return false;
  const drv = d.drivers.find((x) => x.id === driverId)!;
  closeAttempt(o, "Accepted");
  o.offer = null;
  o.driverId = driverId;
  o.vendorId = drv.vendorId;
  o.track = { from: { ...drv.loc }, outAt: null, travelMs: Math.max(20000, Math.round(distKm(drv.loc, o.address.pt) * 14000)) };
  stamp(o, "Accepted", now, drv.name);
  notify(d, `customer:${o.customerId}`, "Driver assigned", `${drv.name} accepted your order and is getting your water ready.`, o.id);
  notify(d, `vendor:${drv.vendorId}`, "Order accepted", `#${o.id} accepted by ${drv.name}.`, o.id);
  return true;
}

export function rejectOffer(d: DB, o: Order, driverId: string, now: number) {
  if (o.status !== "Assigned" || o.offer?.driverId !== driverId) return;
  closeAttempt(o, "Rejected");
  o.offer = null;
  offerNext(d, o, now);
}

export function advance(d: DB, o: Order, to: "Pickup" | "Out for Delivery" | "Arrived", now: number) {
  if (to === "Out for Delivery" && o.track) {
    const drv = d.drivers.find((x) => x.id === o.driverId);
    o.track.outAt = now;
    if (o.status === "Pickup" && o.vendorId) o.track.from = { ...d.vendors.find((v) => v.id === o.vendorId)!.location };
    else if (drv) o.track.from = { ...drv.loc };
    o.track.travelMs = Math.max(20000, Math.round(distKm(o.track.from, o.address.pt) * 14000));
  }
  stamp(o, to, now);
  const msg = { Pickup: "Your water is being loaded at the vendor.", "Out for Delivery": "Your driver is on the way.", Arrived: "Your driver has arrived. Share your delivery OTP." }[to];
  notify(d, `customer:${o.customerId}`, to === "Arrived" ? "Driver arrived" : to, msg, o.id);
}

export function completeDelivery(d: DB, o: Order, opts: { returned: number; photo: boolean; now: number; note?: string }) {
  const { now } = opts;
  o.cans.returned = opts.returned;
  o.proofPhoto = opts.photo;
  if (opts.returned < o.cans.expected) o.cans.note = opts.note || `${o.cans.expected - opts.returned} can(s) not returned — added to customer's can balance`;
  const cust = d.customers.find((c) => c.id === o.customerId);
  const delivered = o.items.reduce((s, i) => s + (d.skus.find((k) => k.id === i.skuId)?.returnable ? i.qty : 0), 0);
  if (cust) cust.cansHeld = Math.max(0, cust.cansHeld + delivered - opts.returned);
  stamp(o, "Delivered", now);
  if (o.payment.method === "COD") o.payment.status = "Collected";
  stamp(o, "Payment Confirmed", now + 1);
  const v = d.vendors.find((x) => x.id === o.vendorId);
  o.invoiceNo = `${v?.gstin ? "INV" : "RCPT"}-${(o.vendorId ?? "").toUpperCase()}-${o.id.slice(2)}`;
  stamp(o, "Completed", now + 2);
  const drv = d.drivers.find((x) => x.id === o.driverId);
  if (drv) drv.loc = { ...o.address.pt };
  notify(d, `customer:${o.customerId}`, "Delivered successfully!", `${o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")} delivered. Rate your delivery.`, o.id);
  if (o.vendorId) notify(d, `vendor:${o.vendorId}`, "Order delivered", `#${o.id} · ${o.payment.method === "COD" ? `${inr(o.total)} cash collected` : "prepaid"}`, o.id);
}

function restoreEntitlement(d: DB, o: Order, note: string) {
  const sub = d.subs.find((s) => s.id === o.subscriptionId);
  if (!sub) return;
  const qty = o.items.reduce((s, i) => s + i.qty, 0);
  sub.used = Math.max(0, sub.used - qty);
  sub.ledger.push({ at: Date.now(), delta: qty, note, orderId: o.id });
}

export function cancelOrder(d: DB, o: Order, by: string, reason: string, now: number, force = false) {
  const policy = cancelPolicy(d.settings, o);
  if (!policy.allowed && !force) return policy.note;
  const fee = force ? 0 : policy.fee;
  if (o.status === "Assigned") closeAttempt(o, "Withdrawn");
  o.offer = null;
  o.cancel = { by, reason, fee };
  stamp(o, "Cancelled", now, by);
  if (o.payment.method === "UPI" || o.payment.method === "Wallet") o.payment.status = "Refund Pending";
  else if (o.payment.method === "Subscription") restoreEntitlement(d, o, "Returned — order cancelled");
  else if (fee > 0 && walletBalance(d, o.customerId) >= fee) {
    d.wallet.unshift({ id: `w${now}`, customerId: o.customerId, amount: -fee, title: `Cancellation fee · #${o.id}`, at: now, ref: o.id });
  }
  notify(d, `customer:${o.customerId}`, "Order cancelled", `#${o.id} was cancelled${by === "Customer" ? "" : ` by ${by}`}.${o.payment.status === "Refund Pending" ? " Your refund will be processed shortly." : ""}`, o.id);
  if (o.vendorId) notify(d, `vendor:${o.vendorId}`, "Order cancelled", `#${o.id} — ${reason}`, o.id);
  return null;
}

/** Vendor/ops exception handling: hand the order straight to a chosen driver. */
export function manualAssign(d: DB, o: Order, driverId: string, actor: string, role: string, now: number) {
  const drv = d.drivers.find((x) => x.id === driverId)!;
  if (o.status === "Assigned") closeAttempt(o, "Withdrawn");
  o.attempts.push({ driverId, vendorId: drv.vendorId, distKm: Math.round(distKm(drv.loc, o.address.pt) * 10) / 10, at: now, result: "Manual" });
  o.offer = null;
  o.driverId = driverId;
  o.vendorId = drv.vendorId;
  o.track = { from: { ...drv.loc }, outAt: null, travelMs: Math.max(20000, Math.round(distKm(drv.loc, o.address.pt) * 14000)) };
  stamp(o, "Accepted", now, `${drv.name} (manual)`);
  audit(d, actor, role, "Manual assignment", `#${o.id}`, `Assigned to ${drv.name}`);
  notify(d, `driver:${driverId}`, "Delivery assigned to you", `#${o.id} · ${o.address.line}`, o.id);
  notify(d, `customer:${o.customerId}`, "Driver assigned", `${drv.name} will deliver your order.`, o.id);
}

export function retryDispatch(d: DB, o: Order, actor: string, role: string, now: number) {
  o.roundStart = o.attempts.length;
  if (o.payment.status === "Refund Pending") o.payment.status = o.payment.method === "COD" ? "Pending" : "Paid";
  stamp(o, "Searching", now, actor);
  audit(d, actor, role, "Dispatch retried", `#${o.id}`, "New dispatch round started");
  offerNext(d, o, now);
}

/* ───────── Placing orders ───────── */

export interface PlaceInput {
  customerId: string; addressId: string;
  lines: { skuId: string; name: string; qty: number; price: number }[];
  subtotal: number; tax: number; deliveryFee: number; deposit: number; discount: number; coupon: string | null; total: number;
  method: PayMethod; type: "Immediate" | "Scheduled"; slot: { date: number; window: string } | null;
  subscriptionId: string | null; routing: "platform" | "direct"; cansExpected: number;
}

export function placeOrder(input: PlaceInput): string {
  let id = "";
  update((d) => {
    const now = Date.now();
    const a = d.addresses.find((x) => x.id === input.addressId)!;
    id = `WD${++d.seq}`;
    const paid = input.method === "UPI" || input.method === "Wallet";
    const o: Order = {
      id, customerId: input.customerId, createdAt: now,
      address: { label: a.label, line: a.line, pin: a.pin, localityId: a.localityId, pt: { ...a.pt } },
      items: input.lines, subtotal: input.subtotal, tax: input.tax, deliveryFee: input.deliveryFee, deposit: input.deposit,
      discount: input.discount, coupon: input.coupon, total: input.total,
      payment: {
        method: input.method, routing: input.routing,
        status: input.method === "Subscription" ? "Covered" : paid ? "Paid" : "Pending",
        ref: input.method === "UPI" ? `UPI${Math.floor(1e9 + Math.random() * 9e9)}` : input.method === "Wallet" ? `WAL${now}` : null,
      },
      type: input.type, slot: input.slot, subscriptionId: input.subscriptionId,
      status: "Placed", vendorId: null, driverId: null, attempts: [], roundStart: 0, offer: null,
      timeline: [{ status: "Placed", at: now }], track: null,
      otp: String(1000 + Math.floor(Math.random() * 9000)), proofPhoto: false,
      cans: { expected: input.cansExpected, returned: null, note: null }, rating: null, cancel: null, invoiceNo: null,
    };
    d.orders.unshift(o);
    if (input.method === "Wallet") d.wallet.unshift({ id: `w${now}`, customerId: input.customerId, amount: -input.total, title: `Paid for order #${id}`, at: now, ref: id });
    if (input.coupon) { const c = d.coupons.find((x) => x.code === input.coupon); if (c) c.used++; }
    if (input.subscriptionId) {
      const sub = d.subs.find((s) => s.id === input.subscriptionId)!;
      const qty = input.lines.reduce((s, l) => s + l.qty, 0);
      sub.used += qty;
      sub.ledger.push({ at: now, delta: -qty, note: input.type === "Scheduled" ? `Scheduled for ${fmtDT(input.slot!.date)}` : "On-demand delivery", orderId: id });
    }
    if (input.type === "Immediate") { stamp(o, "Searching", now + 1); offerNext(d, o, now + 1); }
    else notify(d, `customer:${input.customerId}`, "Delivery scheduled", `#${id} · ${fmtDT(input.slot!.date)} (${input.slot!.window})`, id);
  });
  return id;
}

export function rateOrder(orderId: string, rating: Rating) {
  update((d) => { const o = d.orders.find((x) => x.id === orderId); if (o) o.rating = rating; });
}

/* ───────── Engine ───────── */

const SIM = { decideMs: 3500, pickupMs: 3500, outMs: 7000, handoverMs: 5000 };

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function lastAt(o: Order, s: OrderStatus) {
  for (let i = o.timeline.length - 1; i >= 0; i--) if (o.timeline[i].status === s) return o.timeline[i].at;
  return o.createdAt;
}

/** One pass of the dispatcher. Returns true if anything changed. */
export function tick(d: DB, now: number): boolean {
  const humans = humanDrivers();
  let changed = false;
  for (const o of d.orders) {
    if (DONE.includes(o.status) || o.status === "Cancelled" || o.status === "Failed Assignment") continue;
    const human = !!o.driverId && humans.has(o.driverId);
    switch (o.status) {
      case "Placed":
        // Scheduled deliveries start searching 30 minutes before the slot.
        if (o.type === "Immediate" || (o.slot && o.slot.date - 30 * 60000 <= now)) { stamp(o, "Searching", now); offerNext(d, o, now); changed = true; }
        break;
      case "Searching":
        if (!o.offer) { offerNext(d, o, now); changed = true; }
        break;
      case "Assigned": {
        const off = o.offer;
        if (!off) { offerNext(d, o, now); changed = true; break; }
        if (humans.has(off.driverId)) {
          if (now > off.until) { closeAttempt(o, "Timeout"); o.offer = null; offerNext(d, o, now); changed = true; }
        } else if (now > off.at + SIM.decideMs) {
          // Simulated drivers turn down about one request in four.
          if (hash(o.id + off.driverId) % 4 === 0) rejectOffer(d, o, off.driverId, now);
          else acceptOffer(d, o, off.driverId, now);
          changed = true;
        }
        break;
      }
      case "Accepted":
        if (!human && now > lastAt(o, "Accepted") + SIM.pickupMs) { advance(d, o, "Pickup", now); changed = true; }
        break;
      case "Pickup":
        if (!human && now > lastAt(o, "Pickup") + SIM.outMs - SIM.pickupMs) { advance(d, o, "Out for Delivery", now); changed = true; }
        break;
      case "Out for Delivery":
        if (!human && o.track?.outAt && now > o.track.outAt + o.track.travelMs) { advance(d, o, "Arrived", now); changed = true; }
        break;
      case "Arrived":
        if (!human && now > lastAt(o, "Arrived") + SIM.handoverMs) { completeDelivery(d, o, { returned: o.cans.expected, photo: false, now }); changed = true; }
        break;
    }
  }
  return changed;
}

const needsWork = (d: DB) => d.orders.some((o) => FINDING.includes(o.status) || LIVE.includes(o.status));

/** Mount once per app shell. */
export function useDispatchEngine() {
  useEffect(() => {
    const t = setInterval(() => {
      if (!needsWork(getDB())) return;
      update((d) => (tick(d, Date.now()) ? undefined : false));
    }, 1000);
    return () => clearInterval(t);
  }, []);
}
