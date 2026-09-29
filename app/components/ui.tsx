"use client";

/* Mobile building blocks shared by the Customer and Driver apps — carried over
 * from the Zavtoo frontend (same tokens, cards, sheets and nav pill). */

import { BackIcon, ChevronRight } from "./icons";
import type { OrderStatus } from "../lib/types";

/** Detail-page header: back arrow + title on the canvas, optional actions right. */
export function PageHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "18px 16px 12px",
      position: "sticky", top: 0, zIndex: 20, background: "var(--app-bg)",
    }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" className="press" style={iconBtn}>
          <BackIcon c="var(--ink)" />
        </button>
      )}
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--ink)", flex: 1 }}>{title}</h2>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 18 }}>{right}</div>}
    </div>
  );
}

export const iconBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  display: "flex", alignItems: "center", position: "relative",
};

/** Segmented pill tabs — white track, blue active pill. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div style={{ display: "flex", background: "var(--surface)", borderRadius: 999, padding: 4, boxShadow: "var(--shadow-card)" }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} aria-pressed={on} style={{
            flex: 1, border: "none", cursor: "pointer", borderRadius: 999,
            padding: "9px 6px", fontSize: 13, fontWeight: on ? 600 : 500,
            background: on ? "var(--blue)" : "transparent",
            color: on ? "white" : "var(--ink-soft)",
            transition: "background 0.2s, color 0.2s",
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

type ToneKey = "green" | "amber" | "blue" | "purple" | "red" | "grey";
const TONE: Record<ToneKey, { bg: string; fg: string; bd: string }> = {
  green: { bg: "var(--success)", fg: "var(--success-text)", bd: "var(--success-border)" },
  amber: { bg: "var(--warning)", fg: "var(--warning-text)", bd: "var(--warning-border)" },
  blue: { bg: "var(--info-bg)", fg: "var(--info-text)", bd: "var(--info-border)" },
  purple: { bg: "var(--purple-tint)", fg: "var(--purple)", bd: "#e9e3ff" },
  red: { bg: "var(--error)", fg: "var(--error-text)", bd: "#fecaca" },
  grey: { bg: "var(--surface-dim)", fg: "var(--text-muted)", bd: "var(--border)" },
};

export const STATUS_TONE: Record<OrderStatus, ToneKey> = {
  Placed: "purple", Searching: "purple", Assigned: "purple", Accepted: "blue", Pickup: "blue",
  "Out for Delivery": "amber", Arrived: "amber", Delivered: "green", "Payment Confirmed": "green", Completed: "green",
  Cancelled: "grey", "Failed Assignment": "red",
};

/** Customer-facing wording for the operational status chain. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  Placed: "Scheduled", Searching: "Finding driver", Assigned: "Finding driver", Accepted: "Driver assigned", Pickup: "Loading water",
  "Out for Delivery": "On the way", Arrived: "Driver arrived", Delivered: "Delivered", "Payment Confirmed": "Delivered", Completed: "Delivered",
  Cancelled: "Cancelled", "Failed Assignment": "No driver found",
};

export function Pill({ tone, children }: { tone: ToneKey; children: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <span style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{children}</span>
  );
}

export function StatusBadge({ status, customer }: { status: OrderStatus; customer?: boolean }) {
  return <Pill tone={STATUS_TONE[status]}>{customer ? STATUS_LABEL[status] : status}</Pill>;
}

export function PrimaryButton({ children, onClick, disabled, tone = "blue", style }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: "blue" | "gold" | "go"; style?: React.CSSProperties;
}) {
  const bg = tone === "gold" ? "linear-gradient(135deg,var(--gold),var(--gold-dark))" : tone === "go" ? "linear-gradient(135deg,var(--go-light),var(--go-dark))" : "linear-gradient(135deg,var(--blue),var(--blue-dark))";
  const shadow = tone === "gold" ? "0 6px 16px rgba(245,166,35,0.40)" : tone === "go" ? "0 6px 16px rgba(22,163,74,0.32)" : "0 6px 16px rgba(11,92,255,0.30)";
  return (
    <button onClick={onClick} disabled={disabled} className="press" style={{
      width: "100%", border: "none", borderRadius: 16, padding: "15px 18px",
      fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      background: disabled ? "var(--line-strong)" : bg,
      color: disabled ? "var(--ink-mute)" : tone === "gold" ? "var(--blue-dark)" : "white",
      boxShadow: disabled ? "none" : shadow,
      ...style,
    }}>{children}</button>
  );
}

export function GhostButton({ children, onClick, danger, style }: { children: React.ReactNode; onClick?: () => void; danger?: boolean; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: "100%", borderRadius: 16, padding: "13px 18px", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
      background: "var(--surface)", border: `1.5px solid ${danger ? "#fecaca" : "var(--line-strong)"}`, color: danger ? "var(--error-text)" : "var(--ink)",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...style,
    }}>{children}</button>
  );
}

export const card: React.CSSProperties = { background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-card)" };

export const label: React.CSSProperties = { display: "block", margin: "0 0 8px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" };

export const field: React.CSSProperties = {
  width: "100%", background: "var(--surface)", border: "1.5px solid var(--line)",
  borderRadius: 14, padding: "13px 14px", fontSize: 14, color: "var(--ink)", outline: "none",
};

export const small: React.CSSProperties = { margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 };

/** Sticky footer bar for detail pages with a main action. */
export function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "sticky", bottom: 0, zIndex: 20,
      padding: "12px 16px calc(14px + env(safe-area-inset-bottom))",
      background: "linear-gradient(to top, var(--app-bg) 75%, rgba(238,241,251,0))",
    }}>{children}</div>
  );
}

/** Modal sheet that slides up over the current page. */
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 100, background: "rgba(15,23,41,0.45)", display: "flex", alignItems: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet-up no-scroll" style={{
        width: "100%", maxHeight: "86%", overflowY: "auto", background: "var(--app-bg)",
        borderRadius: "24px 24px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line-strong)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ ...iconBtn, fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label, tone = "blue" }: { on: boolean; onChange: (v: boolean) => void; label: string; tone?: "blue" | "go" }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{
      width: 46, height: 27, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, flexShrink: 0,
      background: on ? (tone === "go" ? "var(--go)" : "var(--blue)") : "var(--line-strong)", transition: "background 0.2s",
      display: "flex", justifyContent: on ? "flex-end" : "flex-start",
    }}>
      <span style={{ width: 21, height: 21, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

/** Read-only star row, e.g. ★★★★☆. */
export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} out of 5 stars`} style={{ color: "var(--gold)", fontSize: size, letterSpacing: 1, lineHeight: 1 }}>
      {"★".repeat(Math.round(value))}<span style={{ color: "var(--line-strong)" }}>{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

/** Tappable 1–5 star picker. */
export function StarPicker({ value, onChange, size = 32, name = "" }: { value: number; onChange: (n: number) => void; size?: number; name?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-label={`${name} ${n} stars`} aria-pressed={n <= value}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: size, lineHeight: 1, color: n <= value ? "var(--gold)" : "var(--line-strong)", padding: 0 }}>★</button>
      ))}
    </div>
  );
}

export function Avatar({ initials, size = 44, tone = "blue" }: { initials: string; size?: number; tone?: "blue" | "go" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: tone === "go" ? "linear-gradient(135deg,var(--go-light),var(--go-dark))" : "linear-gradient(135deg,var(--blue),var(--blue-dark))", color: "white",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700,
    }}>{initials}</div>
  );
}

export const sectionTitle: React.CSSProperties = { margin: "20px 2px 10px", fontSize: 15, fontWeight: 700, color: "var(--ink)" };

export function SectionHead({ title, onAll, allLabel = "View All" }: { title: string; onAll?: () => void; allLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 2px 10px" }}>
      <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{title}</h3>
      {onAll && (
        <button onClick={onAll} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--blue)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
          {allLabel} <ChevronRight s={14} c="var(--blue)" />
        </button>
      )}
    </div>
  );
}

/** Simple full page with a header and a stacked body. */
export function InfoPage({ title, onBack, children, right }: { title: string; onBack: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="fade-up" style={{ paddingBottom: 24 }}>
      <PageHeader title={title} onBack={onBack} right={right} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: "28px 20px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</p>
      {body && <p style={{ ...small, marginTop: 6 }}>{body}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Toast({ msg, bottom = 96 }: { msg: string | null; bottom?: number }) {
  if (!msg) return null;
  return (
    <div className="fade-up" role="status" style={{
      position: "absolute", left: 16, right: 16, bottom, zIndex: 150,
      background: "var(--ink)", color: "white", borderRadius: 14, padding: "12px 16px",
      fontSize: 13.5, fontWeight: 500, boxShadow: "var(--shadow-xl)", textAlign: "center",
    }}>{msg}</div>
  );
}

/** Row of label/value pairs used in bills and summaries. */
export function Line({ k, v, strong, tone }: { k: React.ReactNode; v: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 500, color: tone ?? (strong ? "var(--ink)" : "var(--ink-soft)"), padding: "3px 0" }}>
      <span>{k}</span><span style={{ color: tone ?? "var(--ink)" }}>{v}</span>
    </div>
  );
}

/** Choice chip (slots, tags, languages). */
export function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on} className="press" style={{
      border: `1.5px solid ${on ? "var(--blue)" : "var(--line-strong)"}`, background: on ? "var(--blue-tint)" : "var(--surface)",
      color: disabled ? "var(--ink-mute)" : on ? "var(--blue)" : "var(--ink)", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: disabled ? 0.6 : 1,
    }}>{children}</button>
  );
}

/** Minus / number / plus. */
export function Stepper({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const b: React.CSSProperties = { width: 32, height: 32, borderRadius: 10, border: "1.5px solid var(--line-strong)", background: "var(--surface)", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button aria-label="Decrease" style={{ ...b, opacity: value <= min ? 0.4 : 1 }} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span style={{ minWidth: 18, textAlign: "center", fontSize: 15, fontWeight: 700 }}>{value}</span>
      <button aria-label="Increase" style={{ ...b, opacity: value >= max ? 0.4 : 1 }} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

/** Phone-sized frame used by both mobile apps (the page never scrolls, only the content). */
export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--app-bg)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, height: "100%", position: "relative", background: "var(--app-bg)", overflow: "hidden", boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

/** Floating pill tab bar. */
export function PillNav<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; icon: (c: string) => React.ReactNode; dot?: number | boolean }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 14px calc(10px + env(safe-area-inset-bottom))", pointerEvents: "none", zIndex: 50 }}>
      <nav style={{
        display: "flex", background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderRadius: 999, padding: 4, boxShadow: "0 8px 24px rgba(15,23,41,0.14)", pointerEvents: "auto",
      }}>
        {tabs.map((t) => {
          const on = t.id === active;
          const color = on ? "var(--blue)" : "var(--ink)";
          return (
            <button key={t.id} aria-label={t.label} aria-current={on ? "page" : undefined} onClick={() => onChange(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, position: "relative",
              background: on ? "var(--blue-tint)" : "transparent", border: "none", borderRadius: 999, cursor: "pointer", padding: "6px 0 5px",
            }}>
              {t.icon(color)}
              <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500, color }}>{t.label}</span>
              {!!t.dot && !on && (
                <span style={{
                  position: "absolute", top: 3, left: "calc(50% + 6px)", minWidth: typeof t.dot === "number" ? 16 : 9, height: typeof t.dot === "number" ? 16 : 9, padding: typeof t.dot === "number" ? "0 4px" : 0,
                  borderRadius: 10, background: "var(--red)", border: "1.5px solid white", color: "white", fontSize: 9.5, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{typeof t.dot === "number" ? t.dot : ""}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
