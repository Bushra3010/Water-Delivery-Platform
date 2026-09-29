"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneShell, PillNav, PrimaryButton, Toast, field, label } from "../components/ui";
import { ArrowRight } from "../components/icons";
import { BRAND, BrandMark, Wordmark } from "../components/Brand";
import ProductArt from "../components/ProductArt";
import { useDispatchEngine } from "../lib/actions";
import { isOpen } from "../lib/logic";
import { session, update, useDB } from "../lib/store";
import { t } from "../lib/i18n";
import type { Customer } from "../lib/types";
import HomeScreen from "./Home";
import { AddAddressPage, AddressesPage, OrderPage } from "./Ordering";
import { InvoicePage, OrdersTab, TrackPage } from "./Tracking";
import { PlanDetailPage, PlansTab, SubDetailPage } from "./Plans";
import { EditProfilePage, LanguagePage, NotificationsPage, ProfileTab, SupportPage, WalletPage } from "./Account";

export type CTab = "home" | "orders" | "plans" | "profile";
export type CDetail =
  | { k: "order"; skuId?: string; subId?: string }
  | { k: "addresses"; select?: boolean }
  | { k: "addAddress"; editId?: string; first?: boolean }
  | { k: "track"; id: string }
  | { k: "invoice"; id: string }
  | { k: "plan"; id: string }
  | { k: "sub"; id: string }
  | { k: "wallet" } | { k: "notifications" } | { k: "language" } | { k: "support" } | { k: "editProfile" };

export interface Nav {
  push: (d: CDetail) => void;
  back: () => void;
  replace: (d: CDetail) => void;
  goTab: (t: CTab) => void;
  flash: (m: string) => void;
  addrId: string | null;
  setAddrId: (id: string) => void;
}

export default function CustomerApp() {
  const db = useDB();
  useDispatchEngine();
  const [meId, setMeId] = useState<string | null | undefined>(undefined);
  const [stage, setStage] = useState<"splash" | "login" | "app">("splash");
  const [tab, setTab] = useState<CTab>("home");
  const [stack, setStack] = useState<CDetail[]>([]);
  const [addrId, setAddrId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = session.get("customer");
    setMeId(id);
    if (id) { const t = setTimeout(() => setStage("app"), 900); return () => clearTimeout(t); }
  }, []);

  const detail = stack[stack.length - 1];
  const detailKey = detail ? JSON.stringify(detail) : tab;
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [detailKey]);

  if (!db || meId === undefined) return <PhoneShell><Splash /></PhoneShell>;
  const me: Customer | undefined = meId ? db.customers.find((c) => c.id === meId) : undefined;

  const flash = (m: string) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2000); };
  const nav: Nav = {
    push: (d) => setStack((s) => [...s, d]),
    back: () => setStack((s) => s.slice(0, -1)),
    replace: (d) => setStack((s) => [...s.slice(0, -1), d]),
    goTab: (t) => { setStack([]); setTab(t); },
    flash,
    addrId, setAddrId,
  };

  const login = (id: string, needsAddress: boolean) => {
    session.set("customer", id); setMeId(id); setStage("app"); setTab("home");
    setStack(needsAddress ? [{ k: "addAddress", first: true }] : []);
  };
  const logout = () => { session.set("customer", null); setMeId(null); setStack([]); setStage("login"); };

  if (stage === "splash") return <PhoneShell><Splash onStart={() => setStage(me ? "app" : "login")} /></PhoneShell>;
  if (stage === "login" || !me) return <PhoneShell><LoginFlow onDone={login} /></PhoneShell>;

  if (me.status === "Blocked" || me.status === "Suspended") {
    return (
      <PhoneShell>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 24, textAlign: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Account {me.status.toLowerCase()}</h2>
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>Please contact support on {db.settings.support.phone} to restore access.</p>
          <PrimaryButton onClick={logout}>Log out</PrimaryButton>
        </div>
      </PhoneShell>
    );
  }

  const openOrders = db.orders.filter((o) => o.customerId === me.id && isOpen(o)).length;
  const unread = db.notices.filter((n) => n.to === `customer:${me.id}` && !n.read).length;
  const showNav = !detail;

  return (
    <PhoneShell>
      <div ref={scrollRef} className="no-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingBottom: showNav ? "calc(80px + env(safe-area-inset-bottom))" : undefined }}>
        {detail?.k === "order" && <OrderPage key={JSON.stringify(detail)} me={me} nav={nav} initialSku={detail.skuId} subId={detail.subId} />}
        {detail?.k === "addresses" && <AddressesPage me={me} nav={nav} select={detail.select} />}
        {detail?.k === "addAddress" && <AddAddressPage key={detail.editId ?? "new"} me={me} nav={nav} editId={detail.editId} first={detail.first} />}
        {detail?.k === "track" && <TrackPage key={detail.id} id={detail.id} me={me} nav={nav} />}
        {detail?.k === "invoice" && <InvoicePage id={detail.id} nav={nav} />}
        {detail?.k === "plan" && <PlanDetailPage key={detail.id} id={detail.id} me={me} nav={nav} />}
        {detail?.k === "sub" && <SubDetailPage key={detail.id} id={detail.id} me={me} nav={nav} />}
        {detail?.k === "wallet" && <WalletPage me={me} nav={nav} />}
        {detail?.k === "notifications" && <NotificationsPage me={me} nav={nav} />}
        {detail?.k === "language" && <LanguagePage me={me} nav={nav} />}
        {detail?.k === "support" && <SupportPage nav={nav} />}
        {detail?.k === "editProfile" && <EditProfilePage me={me} nav={nav} />}

        {!detail && tab === "home" && <HomeScreen me={me} nav={nav} unread={unread} />}
        {!detail && tab === "orders" && <OrdersTab me={me} nav={nav} />}
        {!detail && tab === "plans" && <PlansTab me={me} nav={nav} />}
        {!detail && tab === "profile" && <ProfileTab me={me} nav={nav} unread={unread} onLogout={logout} />}
      </div>

      {showNav && (
        <PillNav active={tab} onChange={nav.goTab} tabs={[
          { id: "home", label: t(me.lang, "home"), icon: (c) => <NavGlyph id="home" c={c} /> },
          { id: "orders", label: t(me.lang, "orders"), icon: (c) => <NavGlyph id="orders" c={c} />, dot: openOrders || false },
          { id: "plans", label: t(me.lang, "plans"), icon: (c) => <NavGlyph id="plans" c={c} /> },
          { id: "profile", label: t(me.lang, "profile"), icon: (c) => <NavGlyph id="profile" c={c} /> },
        ]} />
      )}
      <Toast msg={toast} bottom={showNav ? 92 : 100} />
    </PhoneShell>
  );
}

/* Solid glyphs — at 21px a filled shape stays legible where a stroke icon muddies. */
function NavGlyph({ id, c }: { id: CTab; c: string }) {
  switch (id) {
    case "home": return <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><path d="M12 2.5C12 2.5 4.5 11 4.5 15.5a7.5 7.5 0 0 0 15 0C19.5 11 12 2.5 12 2.5z" /><path d="M9.5 15.8a2.6 2.6 0 0 0 2.5 2.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" /></svg>;
    case "orders": return <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><path d="M5.5 7h13l-1 13.2a1.6 1.6 0 0 1-1.6 1.3H8.1a1.6 1.6 0 0 1-1.6-1.3z" /><path d="M9 9V6.5a3 3 0 0 1 6 0V9" stroke={c} strokeWidth="1.9" fill="none" strokeLinecap="round" /><path d="M9.3 13.5l1.9 1.9 3.6-3.6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "plans": return <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M8 2.8v3.4M16 2.8v3.4" stroke={c} strokeWidth="2" strokeLinecap="round" /><path d="M8 13.5a4 4 0 0 1 6.8-2.8M16 13.5a4 4 0 0 1-6.8 2.8" stroke="white" strokeWidth="1.7" fill="none" strokeLinecap="round" /><path d="M15.2 9.6v1.4h-1.4M8.8 17.4V16h1.4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>;
    default: return <svg width="21" height="21" viewBox="0 0 24 24" fill={c}><circle cx="12" cy="7.8" r="4.3" /><path d="M3.8 20.2a8.2 8.2 0 0 1 16.4 0 1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1z" /></svg>;
  }
}

/* ───────────────────────── Splash ───────────────────────── */

function Splash({ onStart }: { onStart?: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, background: "linear-gradient(170deg,#e0f2fe 0%,#bfdbfe 55%,#93c5fd 100%)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <svg viewBox="0 0 400 160" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 220 }} aria-hidden="true">
        <path d="M0 70 C 90 20, 170 120, 260 70 S 380 30, 400 60 V160 H0z" fill="rgba(255,255,255,0.35)" />
        <path d="M0 100 C 110 60, 190 150, 290 100 S 380 80, 400 95 V160 H0z" fill="rgba(11,92,255,0.12)" />
      </svg>
      <div className="fade-up" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, gap: 6, padding: "0 24px" }}>
        <BrandMark size={64} />
        <h1 style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 800, color: "var(--blue-dark)" }}>{BRAND.name}</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)" }}>{BRAND.tagline}</p>
        <div className="bob" style={{ marginTop: 26 }}><ProductArt art="can20" size={170} /></div>
      </div>
      {onStart && (
        <div style={{ padding: "0 20px calc(28px + env(safe-area-inset-bottom))", position: "relative", zIndex: 1 }}>
          <PrimaryButton tone="go" onClick={onStart}>Get Started <ArrowRight s={18} c="white" /></PrimaryButton>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Login / register ───────────────────────── */

function LoginFlow({ onDone }: { onDone: (id: string, needsAddress: boolean) => void }) {
  const db = useDB()!;
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [err, setErr] = useState<string | null>(null);

  const send = () => {
    if (!/^[6-9]\d{9}$/.test(phone)) { setErr("Enter a valid 10-digit mobile number"); return; }
    setErr(null); setStep("otp");
  };
  const verify = () => {
    if (code !== "1234") { setErr("Incorrect OTP"); return; }
    const found = db.customers.find((c) => c.phone === phone);
    if (found) onDone(found.id, !db.addresses.some((a) => a.customerId === found.id));
    else { setErr(null); setStep("profile"); }
  };
  const register = () => {
    if (name.trim().length < 2) { setErr("Please enter your name"); return; }
    const id = `c${Date.now()}`;
    update((d) => { d.customers.push({ id, name: name.trim(), phone, lang, status: "Active", cansHeld: 0, joinedAt: Date.now() }); });
    onDone(id, true);
  };

  return (
    <div className="fade-up" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 20px", overflowY: "auto" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><BrandMark size={46} /><Wordmark /></div>
        {step === "profile" ? (
          <>
            <h1 style={{ margin: "26px 0 4px", fontSize: 25, fontWeight: 800 }}>Create your profile</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>+91 {phone} verified. Just two more things.</p>
            <div style={{ marginTop: 22 }}>
              <label style={label} htmlFor="c-name">Your name</label>
              <input id="c-name" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} style={field} autoComplete="name" />
              <p style={{ ...label, marginTop: 16 }}>Preferred language</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {db.settings.languages.filter((l) => l.enabled).map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} aria-pressed={lang === l.code} style={{
                    border: `1.5px solid ${lang === l.code ? "var(--blue)" : "var(--line-strong)"}`, background: lang === l.code ? "var(--blue-tint)" : "var(--surface)",
                    color: lang === l.code ? "var(--blue)" : "var(--ink)", borderRadius: 12, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer",
                  }}>{l.name}</button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ margin: "26px 0 4px", fontSize: 25, fontWeight: 800 }}>Login with mobile</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>We&apos;ll send a one-time password to verify.</p>
            <div style={{ marginTop: 22 }}>
              <label style={label} htmlFor="c-phone">Mobile number</label>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ ...field, width: "auto", display: "flex", alignItems: "center", color: "var(--ink-soft)" }}>+91</span>
                <input id="c-phone" inputMode="numeric" autoComplete="tel-national" value={phone} disabled={step === "otp"}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setErr(null); }} style={{ ...field, flex: 1 }} />
              </div>
              {step === "otp" && (
                <div className="fade-up" style={{ marginTop: 16 }}>
                  <label style={label} htmlFor="c-otp">OTP sent to +91 {phone}</label>
                  <input id="c-otp" inputMode="numeric" autoComplete="one-time-code" value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(null); }}
                    style={{ ...field, fontSize: 22, fontWeight: 800, letterSpacing: "0.5em", textAlign: "center" }} />
                  <p style={{ margin: "6px 2px 0", fontSize: 11.5, color: "var(--ink-mute)" }}>Demo OTP: 1234 · <button onClick={() => { setStep("phone"); setCode(""); }} style={{ background: "none", border: "none", padding: 0, color: "var(--blue)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Change number</button></p>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 12, background: "var(--gold-tint)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Demo customer: <b>9876543210</b> (Rahul Sharma). Any other number creates a new account.
              <button onClick={() => { setPhone("9876543210"); setErr(null); }} style={{ marginLeft: 6, background: "none", border: "none", padding: 0, color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Use it</button>
            </div>
          </>
        )}
        {err && <p role="alert" style={{ margin: "10px 2px 0", fontSize: 12.5, color: "var(--error-text)", fontWeight: 600 }}>{err}</p>}
      </div>
      <div style={{ padding: "16px 0 calc(24px + env(safe-area-inset-bottom))" }}>
        {step === "phone" && <PrimaryButton disabled={phone.length !== 10} onClick={send}>Send OTP</PrimaryButton>}
        {step === "otp" && <PrimaryButton disabled={code.length !== 4} onClick={verify}>Verify &amp; Continue</PrimaryButton>}
        {step === "profile" && <PrimaryButton tone="go" onClick={register}>Continue</PrimaryButton>}
      </div>
    </div>
  );
}
