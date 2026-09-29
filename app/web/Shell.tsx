"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "../components/Brand";
import { BellIcon } from "../components/icons";
import { fmtDT } from "../lib/logic";
import { update, useData } from "../lib/store";
import { Btn, ReadOnly } from "./kit";

export interface NavGroup<S extends string> { group: string; items: { id: S; label: string; icon: string }[] }

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = (m: string) => { setToast(m); clearTimeout(t.current); t.current = setTimeout(() => setToast(null), 2600); };
  const el = toast ? (
    <div className="fade-up" role="status" style={{ position: "fixed", right: 20, bottom: 20, zIndex: 300, maxWidth: "calc(100vw - 40px)", background: "var(--ink)", color: "white", borderRadius: 12, padding: "12px 16px", fontSize: 13.5, fontWeight: 500, boxShadow: "var(--shadow-xl)" }}>✓ {toast}</div>
  ) : null;
  return { show, el };
}

export function WebShell<S extends string>({
  brand, sub, nav, section, onSection, badges = {}, title, user, onLogout, readOnly = false, noticeTo, children, toast,
}: {
  brand: string; sub: string; nav: NavGroup<S>[]; section: S; onSection: (s: S) => void; badges?: Partial<Record<S, number>>;
  title: string; user: { name: string; sub: string }; onLogout: () => void; readOnly?: boolean; noticeTo: string;
  children: React.ReactNode; toast?: React.ReactNode;
}) {
  const db = useData();
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [section]);
  const notices = db.notices.filter((n) => n.to === noticeTo).slice(0, 20);
  const unread = notices.filter((n) => !n.read).length;

  return (
    <ReadOnly.Provider value={readOnly}>
      <div style={{ background: "var(--app-bg)", minHeight: "100vh" }}>
        <div className="admin-shell">
          <aside className={`admin-side no-scroll${menu ? " open" : ""}`} style={{ background: "#0b1f4d", color: "white", padding: "18px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 18px" }}>
              <BrandMark size={32} />
              <div><p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{brand}</p><p style={{ margin: 0, fontSize: 10.5, color: "rgba(255,255,255,0.6)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{sub}</p></div>
            </div>
            {nav.map((g) => (
              <div key={g.group} style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 10px 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{g.group}</p>
                {g.items.map((it) => {
                  const on = section === it.id;
                  const n = badges[it.id];
                  return (
                    <button key={it.id} onClick={() => { onSection(it.id); setMenu(false); }} aria-current={on ? "page" : undefined} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: on ? "var(--blue)" : "transparent", color: on ? "white" : "rgba(255,255,255,0.78)", fontSize: 13.5, fontWeight: on ? 700 : 500, textAlign: "left",
                    }}>
                      <span style={{ width: 20, textAlign: "center" }}>{it.icon}</span>
                      <span style={{ flex: 1 }}>{it.label}</span>
                      {n ? <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: "var(--gold)", color: "var(--blue-dark)", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 12, marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {[["/", "All apps"], ["/customer", "Customer app"], ["/driver", "Driver app"], ["/vendor", "Vendor panel"], ["/admin", "Super admin"]].map(([h, l]) => (
                <Link key={h} href={h} style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, fontWeight: 600, textDecoration: "none", padding: "5px 10px" }}>↗ {l}</Link>
              ))}
            </div>
          </aside>
          {menu && <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(15,23,41,0.4)" }} />}

          <div style={{ minWidth: 0 }}>
            <div className="admin-topbar" style={{ alignItems: "center", gap: 10, padding: "12px 16px", background: "#0b1f4d", color: "white", position: "sticky", top: 0, zIndex: 100 }}>
              <button onClick={() => setMenu(true)} aria-label="Open menu" style={{ background: "none", border: "none", color: "white", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>☰</button>
              <span style={{ fontWeight: 800 }}>{brand}</span>
            </div>
            <main className="admin-main">
              <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{title}</h1>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
                  {readOnly && <span style={{ fontSize: 11, fontWeight: 800, color: "var(--warning-text)", background: "var(--warning)", borderRadius: 8, padding: "4px 8px" }}>READ-ONLY</span>}
                  <button onClick={() => setBell((b) => !b)} aria-label={`Notifications, ${unread} unread`} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, width: 38, height: 38, cursor: "pointer", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BellIcon s={19} c="var(--text-secondary)" />
                    {unread > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, borderRadius: 9, background: "var(--red)", color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{unread}</span>}
                  </button>
                  {bell && (
                    <div className="fade-up" style={{ position: "absolute", top: 46, right: 0, width: 330, maxWidth: "90vw", maxHeight: 380, overflowY: "auto", background: "var(--surface)", borderRadius: 14, boxShadow: "var(--shadow-xl)", border: "1px solid var(--line)", zIndex: 120 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
                        <b style={{ fontSize: 13.5 }}>Notifications</b>
                        <button onClick={() => update((d) => { d.notices.forEach((n) => { if (n.to === noticeTo) n.read = true; }); })} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Mark all read</button>
                      </div>
                      {notices.map((n) => (
                        <div key={n.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", background: n.read ? "transparent" : "var(--blue-tint)" }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{n.title}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{n.body}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--ink-mute)" }}>{fmtDT(n.at)}</p>
                        </div>
                      ))}
                      {!notices.length && <p style={{ padding: 14, margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>Nothing yet.</p>}
                    </div>
                  )}
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{user.name}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-mute)" }}>{user.sub}</p>
                  </div>
                  <Btn safe kind="ghost" small onClick={onLogout}>Log out</Btn>
                </div>
              </header>
              {children}
              <p style={{ margin: "28px 0 0", textAlign: "center", fontSize: 11.5, color: "var(--ink-mute)" }}>Demo data · shared live with the customer &amp; driver apps in this browser</p>
            </main>
          </div>
        </div>
        {toast}
      </div>
    </ReadOnly.Provider>
  );
}

/** Centered login card used by both web panels. */
export function WebLogin({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "linear-gradient(150deg,#0b1f4d,var(--blue))" }}>
      <div className="fade-up" style={{ width: "100%", maxWidth: 440, background: "var(--surface)", borderRadius: 20, padding: 26, boxShadow: "0 20px 50px rgba(4,36,107,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><BrandMark size={40} /><div><p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>Water Delivery Platform</p></div></div>
        <p style={{ margin: "14px 0 18px", fontSize: 13, color: "var(--ink-soft)" }}>{body}</p>
        {children}
      </div>
    </div>
  );
}
