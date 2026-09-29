"use client";

/* Desktop building blocks for the Vendor and Super Admin panels — carried over
 * from the Zavtoo admin kit, plus pagination, charts and a read-only mode
 * (RBAC: read-only roles see every action button disabled). */

import { createContext, useContext, useEffect, useState } from "react";
import { SearchIcon } from "../components/icons";
import type { OrderStatus } from "../lib/types";

export type Tone = "blue" | "green" | "amber" | "red" | "purple" | "grey";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: "var(--info-bg)", fg: "var(--info-text)" },
  green: { bg: "var(--success)", fg: "var(--success-text)" },
  amber: { bg: "var(--warning)", fg: "var(--warning-text)" },
  red: { bg: "var(--error)", fg: "var(--error-text)" },
  purple: { bg: "var(--purple-tint)", fg: "var(--purple)" },
  grey: { bg: "var(--surface-dim)", fg: "var(--text-muted)" },
};

export const ORDER_TONE: Record<OrderStatus, Tone> = {
  Placed: "purple", Searching: "purple", Assigned: "purple", Accepted: "blue", Pickup: "blue", "Out for Delivery": "amber", Arrived: "amber",
  Delivered: "green", "Payment Confirmed": "green", Completed: "green", Cancelled: "grey", "Failed Assignment": "red",
};

export const STATUS_TONE: Record<string, Tone> = {
  Active: "green", Verified: "green", Approved: "blue", Paid: "green", Collected: "green", Covered: "green", Refunded: "grey",
  Pending: "amber", "Pending Review": "amber", "Refund Pending": "amber", Maintenance: "amber", Expired: "grey",
  Inactive: "grey", Cancelled: "grey", Suspended: "red", Blocked: "red", Rejected: "red", Failed: "red", Missing: "red",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return <span style={{ background: t.bg, color: t.fg, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{children}</span>;
}
export const SBadge = ({ s }: { s: string }) => <Badge tone={STATUS_TONE[s] ?? ORDER_TONE[s as OrderStatus] ?? "grey"}>{s}</Badge>;

export function Panel({ title, actions, children, pad = true }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <section style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "var(--shadow-card)", border: "1px solid var(--line)", minWidth: 0 }}>
      {(title || actions) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
          {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
        </div>
      )}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "blue", icon }: { label: string; value: string; sub?: string; tone?: Tone; icon?: string }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, padding: "14px 16px", boxShadow: "var(--shadow-card)", border: "1px solid var(--line)", display: "flex", gap: 12, alignItems: "flex-start" }}>
      {icon && <span style={{ width: 38, height: 38, borderRadius: 12, background: TONES[tone].bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</span>}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{value}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: TONES[tone].fg, fontWeight: 600 }}>{sub}</p>}
      </div>
    </div>
  );
}

export interface Col<T> {
  key: string;
  head: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
}

/** Scrolls sideways on narrow screens; paginates long lists. */
export function Table<T>({ cols, rows, rowKey, empty = "Nothing to show.", pageSize = 10, onRow }: { cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; empty?: string; pageSize?: number; onRow?: (r: T) => void }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);
  const shown = rows.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <div>
      <div className="no-scroll" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} style={{ textAlign: c.align ?? "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap", width: c.width, background: "var(--bg-secondary)" }}>{c.head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={rowKey(r)} className="admin-row" onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? "pointer" : undefined }}>
                {cols.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? "left", padding: "11px 14px", borderBottom: "1px solid var(--line)", verticalAlign: "middle" }}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: "32px 14px", textAlign: "center", color: "var(--ink-mute)" }}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", fontSize: 12, color: "var(--ink-soft)" }}>
          <span>Showing {page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn safe small kind="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Prev</Btn>
            <Btn safe small kind="ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next ›</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/** True for roles that may look but not touch. */
export const ReadOnly = createContext(false);

export function Btn({ children, onClick, kind = "primary", disabled, small, type = "button", safe }: {
  children: React.ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger" | "gold" | "go"; disabled?: boolean; small?: boolean; type?: "button" | "submit";
  /** Navigation / view-only buttons stay enabled for read-only roles. */
  safe?: boolean;
}) {
  const ro = useContext(ReadOnly) && !safe;
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--blue)", color: "white", border: "1px solid var(--blue)" },
    go: { background: "var(--go)", color: "white", border: "1px solid var(--go)" },
    gold: { background: "var(--gold)", color: "var(--blue-dark)", border: "1px solid var(--gold)" },
    ghost: { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--line-strong)" },
    danger: { background: "var(--surface)", color: "var(--error-text)", border: "1px solid #fecaca" },
  };
  const off = disabled || ro;
  return (
    <button type={type} onClick={(e) => { e.stopPropagation(); onClick?.(); }} disabled={off} title={ro ? "Read-only access" : undefined} className="press" style={{
      ...styles[kind], borderRadius: 10, padding: small ? "5px 10px" : "8px 14px", fontSize: small ? 12 : 13, fontWeight: 600,
      cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.5 : 1, whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-secondary)", borderRadius: 10, padding: "7px 10px", minWidth: 200 }}>
      <SearchIcon s={16} c="var(--ink-mute)" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--ink)", flex: 1, minWidth: 0 }} />
    </label>
  );
}

/** Pill filter row: All / Active / … */
export function Filter<T extends string>({ options, value, onChange, counts }: { options: readonly T[]; value: T; onChange: (v: T) => void; counts?: Partial<Record<T, number>> }) {
  return (
    <div className="no-scroll" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} aria-pressed={on} style={{
            border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            background: on ? "var(--blue)" : "var(--bg-secondary)", color: on ? "white" : "var(--text-secondary)",
          }}>{o}{counts?.[o] !== undefined && <span style={{ opacity: 0.7, marginLeft: 5 }}>{counts[o]}</span>}</button>
        );
      })}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="fade-up" style={{ width: "100%", maxWidth: wide ? 820 : 500, maxHeight: "92vh", display: "flex", flexDirection: "column", background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "var(--ink-mute)" }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: "auto" }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>{footer}</div>}
      </div>
    </div>
  );
}

export const input: React.CSSProperties = {
  width: "100%", background: "var(--surface)", border: "1.5px solid var(--line-strong)", borderRadius: 10,
  padding: "9px 11px", fontSize: 13.5, color: "var(--ink)", outline: "none",
};

export const fieldLabel: React.CSSProperties = { display: "block", margin: "0 0 6px", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" };

export const muted: React.CSSProperties = { fontSize: 12, color: "var(--ink-mute)" };

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={fieldLabel}>{label}</span>
      {children}
      {hint && <span style={{ ...muted, display: "block", marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export function Initials({ name, size = 30 }: { name: string; size?: number }) {
  const t = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "var(--blue-tint)", color: "var(--blue)", fontSize: size * 0.36, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{t}</span>;
}

export function KV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <span style={{ color: "var(--ink-soft)" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const ro = useContext(ReadOnly);
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={ro} onClick={() => onChange(!on)} style={{
      width: 40, height: 23, borderRadius: 999, border: "none", cursor: ro ? "not-allowed" : "pointer", padding: 3, flexShrink: 0, opacity: ro ? 0.6 : 1,
      background: on ? "var(--go)" : "var(--line-strong)", display: "flex", justifyContent: on ? "flex-end" : "flex-start",
    }}>
      <span style={{ width: 17, height: 17, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

/* ───────────────────────── Charts ───────────────────────── */

/** Line + soft area, one series. Hover shows the value. */
export function LineChart({ data, height = 190, fmt = (v: number) => String(v) }: { data: { label: string; v: number }[]; height?: number; fmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, pl = 44, pr = 10, pt = 12, pb = 26;
  const max = Math.max(1, ...data.map((d) => d.v)) * 1.1;
  const x = (i: number) => pl + (i * (W - pl - pr)) / Math.max(1, data.length - 1);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.v)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const every = Math.ceil(data.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} onMouseLeave={() => setHover(null)} role="img" aria-label="Line chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pl - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--ink-mute)">{fmt(Math.round(t))}</text>
        </g>
      ))}
      <path d={`${path} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--blue)" fillOpacity="0.08" />
      <path d={path} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          {i % every === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-mute)">{d.label}</text>}
          <rect x={x(i) - (W - pl - pr) / data.length / 2} y={pt} width={(W - pl - pr) / data.length} height={H - pt - pb} fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      {hover !== null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="var(--line-strong)" strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(data[hover].v)} r="4.5" fill="var(--blue)" stroke="white" strokeWidth="2" />
          <g transform={`translate(${Math.min(W - 110, Math.max(pl, x(hover) - 50))} ${Math.max(0, y(data[hover].v) - 34)})`}>
            <rect width="100" height="24" rx="6" fill="var(--ink)" />
            <text x="50" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">{data[hover].label}: {fmt(data[hover].v)}</text>
          </g>
        </g>
      )}
    </svg>
  );
}

/** Vertical bars with the last bar highlighted. */
export function Bars({ data, height = 170, fmt = (v: number) => String(v) }: { data: { label: string; v: number }[]; height?: number; fmt?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4, minWidth: 0 }}>
          <div title={`${d.label}: ${fmt(d.v)}`} style={{ width: "100%", maxWidth: 26, height: `${Math.max(2, (d.v / max) * 100)}%`, borderRadius: "5px 5px 2px 2px", background: i === data.length - 1 ? "var(--gold)" : "var(--blue)", opacity: i === data.length - 1 ? 1 : 0.85 }} />
          <span style={{ fontSize: 9.5, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{data.length > 16 ? (i % 3 === 0 ? d.label : "") : d.label}</span>
        </div>
      ))}
    </div>
  );
}

const DONUT = ["var(--blue)", "var(--go)", "var(--gold)", "var(--purple)", "var(--teal)", "var(--red)"];

export function Donut({ parts, center, size = 150 }: { parts: { label: string; v: number }[]; center?: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Donut chart">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="18" />
        {parts.map((p, i) => {
          const len = (p.v / total) * c;
          const el = <circle key={p.label} cx="70" cy="70" r={r} fill="none" stroke={DONUT[i % DONUT.length]} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />;
          acc += len;
          return el;
        })}
        {center && <text x="70" y="76" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--ink)">{center}</text>}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
        {parts.map((p, i) => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: DONUT[i % DONUT.length] }} />
            <span style={{ flex: 1 }}>{p.label}</span>
            <b>{Math.round((p.v / total) * 100)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal share bars (top products, zones…). */
export function ShareBars({ rows, fmt = (v: number) => String(v) }: { rows: { label: string; v: number }[]; fmt?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}><span>{r.label}</span><b>{fmt(r.v)}</b></div>
          <div style={{ height: 7, borderRadius: 4, background: "var(--line)" }}><div style={{ width: `${(r.v / max) * 100}%`, height: "100%", borderRadius: 4, background: "var(--blue)" }} /></div>
        </div>
      ))}
    </div>
  );
}
