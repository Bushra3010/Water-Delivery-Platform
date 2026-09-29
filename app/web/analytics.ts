/* Aggregations for dashboards and reports — computed from order rows, so the
 * same code will run against Supabase views later. */

import { DAY, DONE, FINDING, LIVE, startOfDay } from "../lib/logic";
import type { Order } from "../lib/types";

export const isDone = (o: Order) => DONE.includes(o.status);
export const gmv = (os: Order[]) => os.filter(isDone).reduce((s, o) => s + o.total, 0);

export function daily(os: Order[], days: number, value: (os: Order[]) => number, now = Date.now()) {
  const t0 = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const from = t0 - (days - 1 - i) * DAY;
    const bucket = os.filter((o) => o.createdAt >= from && o.createdAt < from + DAY);
    return { label: new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), v: value(bucket) };
  });
}

export const inRange = (os: Order[], from: number, to = Infinity) => os.filter((o) => o.createdAt >= from && o.createdAt < to);

export function bucketStatus(o: Order): "Requested" | "Accepted" | "In progress" | "Delivered" | "Cancelled" | "Failed" | "Scheduled" {
  if (o.status === "Placed") return "Scheduled";
  if (FINDING.includes(o.status)) return "Requested";
  if (o.status === "Accepted") return "Accepted";
  if (LIVE.includes(o.status)) return "In progress";
  if (isDone(o)) return "Delivered";
  if (o.status === "Cancelled") return "Cancelled";
  return "Failed";
}

export function deliveryMins(o: Order) {
  const a = o.timeline.find((t) => t.status === "Placed")?.at;
  const b = o.timeline.find((t) => t.status === "Delivered")?.at;
  return a && b ? Math.round((b - a) / 60000) : null;
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** "+12% from last week" style comparison. */
export function trend(cur: number, prev: number) {
  if (!prev) return cur ? "new this week" : "no change";
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d >= 0 ? "↑" : "↓"} ${Math.abs(d)}% vs last week`;
}
