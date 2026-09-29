"use client";

import { useState } from "react";
import CityMap from "../components/CityMap";
import { audit, cancelOrder, manualAssign, notify, retryDispatch } from "../lib/actions";
import { DONE, FINDING, distKm, driverBlockers, fmtDT, fmtTime, inr, isOpen, maskPhone } from "../lib/logic";
import { update, useData } from "../lib/store";
import { Badge, Btn, KV, Modal, ORDER_TONE, SBadge, Table, input, muted } from "./kit";

export interface Actor { name: string; role: string }

export function OrderModal({ id, onClose, actor, vendorId, canRefund, toast }: {
  id: string; onClose: () => void; actor: Actor; vendorId?: string; canRefund?: boolean; toast: (m: string) => void;
}) {
  const db = useData();
  const [assign, setAssign] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"none" | "cancel" | "refund">("none");
  const [refundTo, setRefundTo] = useState<"wallet" | "source">("source");
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  const cust = db.customers.find((c) => c.id === o.customerId);
  const vendor = db.vendors.find((v) => v.id === o.vendorId);
  const driver = db.drivers.find((d) => d.id === o.driverId);
  const loc = db.localities.find((l) => l.id === o.address.localityId);

  const pool = db.drivers.filter((d) => (vendorId ? d.vendorId === vendorId : true) && d.status === "Active" && d.kyc === "Verified" && driverBlockers(db, d).length === 0)
    .map((d) => ({ d, km: distKm(d.loc, o.address.pt) })).sort((a, b) => a.km - b.km);
  const canAssign = FINDING.includes(o.status) || o.status === "Failed Assignment";
  const mut = (fn: Parameters<typeof update>[0]) => update(fn);
  const refundAmt = o.total - (o.cancel?.fee ?? 0);

  return (
    <Modal wide title={`Order #${o.id}`} onClose={onClose} footer={
      <>
        {canAssign && pool.length > 0 && (
          <>
            <select value={assign} onChange={(e) => setAssign(e.target.value)} aria-label="Driver" style={{ ...input, width: "auto", minWidth: 220 }}>
              <option value="">Assign driver manually…</option>
              {pool.map(({ d, km }) => <option key={d.id} value={d.id}>{d.name} · {db.vendors.find((v) => v.id === d.vendorId)?.name} · {km.toFixed(1)} km</option>)}
            </select>
            <Btn disabled={!assign} onClick={() => { mut((d) => { manualAssign(d, d.orders.find((x) => x.id === o.id)!, assign, actor.name, actor.role, Date.now()); }); toast("Driver assigned"); setAssign(""); }}>Assign</Btn>
          </>
        )}
        {o.status === "Failed Assignment" && <Btn kind="gold" onClick={() => { mut((d) => { retryDispatch(d, d.orders.find((x) => x.id === o.id)!, actor.name, actor.role, Date.now()); }); toast("Dispatch restarted"); }}>Retry auto-dispatch</Btn>}
        {isOpen(o) && <Btn kind="danger" onClick={() => setMode("cancel")}>Cancel order</Btn>}
        {canRefund && o.payment.status === "Refund Pending" && <Btn kind="go" onClick={() => setMode("refund")}>Process refund</Btn>}
        <Btn safe kind="ghost" onClick={onClose}>Close</Btn>
      </>
    }>
      {mode === "cancel" && (
        <div style={{ background: "var(--error)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <b style={{ fontSize: 13 }}>Cancel this order?</b>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shared with the customer)" aria-label="Reason" style={{ ...input, marginTop: 8 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Btn kind="danger" disabled={reason.trim().length < 3} onClick={() => {
              mut((d) => { const x = d.orders.find((y) => y.id === o.id)!; cancelOrder(d, x, actor.role === "Vendor Admin" ? "Vendor" : "Support", reason.trim(), Date.now(), true); audit(d, actor.name, actor.role, "Order cancelled", `#${o.id}`, reason.trim()); });
              setMode("none"); toast("Order cancelled");
            }}>Confirm cancel</Btn>
            <Btn safe kind="ghost" onClick={() => setMode("none")}>Keep order</Btn>
          </div>
        </div>
      )}
      {mode === "refund" && (
        <div style={{ background: "var(--success)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <b style={{ fontSize: 13 }}>Refund {inr(refundAmt)} to {cust?.name}</b>
          <div style={{ display: "flex", gap: 14, margin: "8px 0", fontSize: 13 }}>
            <label><input type="radio" checked={refundTo === "source"} onChange={() => setRefundTo("source")} /> Original method ({o.payment.method})</label>
            <label><input type="radio" checked={refundTo === "wallet"} onChange={() => setRefundTo("wallet")} /> Customer wallet</label>
          </div>
          <Btn kind="go" onClick={() => {
            mut((d) => {
              const x = d.orders.find((y) => y.id === o.id)!;
              x.payment.status = "Refunded";
              if (refundTo === "wallet" || x.payment.method === "Wallet") d.wallet.unshift({ id: `w${Date.now()}`, customerId: x.customerId, amount: refundAmt, title: `Refund · #${x.id}`, at: Date.now(), ref: x.id });
              audit(d, actor.name, actor.role, "Refund processed", `#${x.id}`, `${inr(refundAmt)} to ${refundTo === "wallet" || x.payment.method === "Wallet" ? "wallet" : x.payment.method}`);
              notify(d, `customer:${x.customerId}`, "Refund processed", `${inr(refundAmt)} for #${x.id} has been refunded.`, x.id);
            });
            setMode("none"); toast("Refund processed");
          }}>Confirm refund</Btn>
        </div>
      )}

      <div className="admin-grid-even">
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge>
            <Badge tone="purple">{o.type}{o.slot ? ` · ${fmtDT(o.slot.date)} ${o.slot.window}` : ""}</Badge>
            {o.subscriptionId && <Badge tone="blue">Subscription</Badge>}
          </div>
          <KV k="Customer" v={`${cust?.name} · ${vendorId ? maskPhone(cust?.phone ?? "") : cust?.phone}`} />
          <KV k="Address" v={`${o.address.line}, ${loc?.name} ${o.address.pin}`} />
          <KV k="Items" v={o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")} />
          <KV k="Subtotal / tax / fees" v={`${inr(o.subtotal)} / ${inr(o.tax)} / ${inr(o.deliveryFee + o.deposit)}`} />
          {o.discount > 0 && <KV k="Discount" v={`− ${inr(o.discount)} (${o.coupon})`} />}
          <KV k="Total" v={inr(o.total)} />
          <KV k="Payment" v={<span>{o.payment.method} · <SBadge s={o.payment.status} /> · {o.payment.routing === "direct" ? "direct to vendor" : "platform"}</span>} />
          {o.payment.ref && <KV k="Payment ref" v={o.payment.ref} />}
          <KV k="Vendor / driver" v={`${vendor?.name ?? "—"} / ${driver?.name ?? "—"}`} />
          <KV k="Cans (returned / expected)" v={`${o.cans.returned ?? "—"} / ${o.cans.expected}`} />
          {o.cans.note && <p style={{ ...muted, color: "var(--warning-text)" }}>{o.cans.note}</p>}
          {DONE.includes(o.status) && <KV k="Proof of delivery" v={`OTP verified${o.proofPhoto ? " · photo ✓" : ""}`} />}
          {o.invoiceNo && <KV k="Invoice" v={o.invoiceNo} />}
          {o.cancel && <KV k="Cancelled" v={`${o.cancel.by}: ${o.cancel.reason}${o.cancel.fee ? ` (fee ${inr(o.cancel.fee)})` : ""}`} />}
          {o.rating && <KV k="Rating (driver / vendor / water)" v={`★${o.rating.driver} / ★${o.rating.vendor} / ★${o.rating.product}${o.rating.comment ? ` — “${o.rating.comment}”` : ""}`} />}
          <div style={{ marginTop: 12 }}>
            <CityMap height={170} fit={[o.address.pt, ...(vendor ? [vendor.location] : [])]} showLabels={false}
              markers={[{ id: "h", pt: o.address.pt, kind: "home" }, ...(vendor ? [{ id: "v", pt: vendor.location, kind: "vendor" as const }] : []), ...(driver ? [{ id: "d", pt: driver.loc, kind: "driver" as const }] : [])]} />
          </div>
        </div>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Status timeline</p>
          <div style={{ borderLeft: "2px solid var(--line)", paddingLeft: 12, marginLeft: 4 }}>
            {o.timeline.map((t, i) => (
              <div key={i} style={{ position: "relative", padding: "4px 0", fontSize: 12.5 }}>
                <span style={{ position: "absolute", left: -18, top: 9, width: 10, height: 10, borderRadius: "50%", background: "var(--blue)" }} />
                <b>{t.status}</b>{t.by ? <span style={muted}> · {t.by}</span> : null}
                <span style={{ ...muted, float: "right" }}>{fmtTime(t.at)}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "16px 0 8px", fontSize: 13, fontWeight: 700 }}>Dispatch attempts ({o.attempts.length})</p>
          <Table pageSize={8} rows={o.attempts.map((a, i) => ({ ...a, i }))} rowKey={(a) => String(a.i)} empty="No dispatch attempts yet." cols={[
            { key: "n", head: "#", render: (a) => a.i + 1 },
            { key: "d", head: "Driver", render: (a) => db.drivers.find((d) => d.id === a.driverId)?.name },
            { key: "v", head: "Vendor", render: (a) => <span style={muted}>{db.vendors.find((v) => v.id === a.vendorId)?.name}</span> },
            { key: "k", head: "Dist", render: (a) => `${a.distKm} km` },
            { key: "t", head: "At", render: (a) => fmtTime(a.at) },
            { key: "r", head: "Result", render: (a) => <Badge tone={a.result === "Accepted" || a.result === "Manual" ? "green" : a.result === "Offered" ? "purple" : a.result === "Rejected" || a.result === "Timeout" ? "amber" : "grey"}>{a.result}</Badge> },
          ]} />
        </div>
      </div>
    </Modal>
  );
}
