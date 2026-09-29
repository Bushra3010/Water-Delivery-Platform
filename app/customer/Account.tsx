"use client";

import Link from "next/link";
import { useState } from "react";
import { BellIcon, CanIcon, ChevronRight, GlobeIcon, HelpIcon, LogoutIcon, PhoneIcon, PinIcon, UserIcon, WalletIcon, WhatsAppIcon } from "../components/icons";
import { Avatar, Chip, Empty, Footer, InfoPage, PrimaryButton, card, field, label, small } from "../components/ui";
import { notify } from "../lib/actions";
import { fmtDT, initials, inr, walletBalance } from "../lib/logic";
import { resetDemo, update, useData } from "../lib/store";
import type { Customer } from "../lib/types";
import type { CDetail, Nav } from "./CustomerApp";
import { UpiSheet } from "./Ordering";

export function ProfileTab({ me, nav, unread, onLogout }: { me: Customer; nav: Nav; unread: number; onLogout: () => void }) {
  const db = useData();
  const orders = db.orders.filter((o) => o.customerId === me.id);
  const lang = db.settings.languages.find((l) => l.code === me.lang)?.name ?? "English";
  const menu: { icon: React.ReactNode; label: string; sub?: string; to: CDetail }[] = [
    { icon: <UserIcon s={20} c="var(--blue)" />, label: "Edit profile", to: { k: "editProfile" } },
    { icon: <PinIcon s={20} c="var(--blue)" />, label: "Saved addresses", sub: `${db.addresses.filter((a) => a.customerId === me.id).length} saved`, to: { k: "addresses" } },
    { icon: <WalletIcon s={20} c="var(--blue)" />, label: "Wallet", sub: inr(walletBalance(db, me.id)), to: { k: "wallet" } },
    { icon: <BellIcon s={20} c="var(--blue)" />, label: "Notifications", sub: unread ? `${unread} unread` : undefined, to: { k: "notifications" } },
    { icon: <GlobeIcon s={20} c="var(--blue)" />, label: "Language", sub: lang, to: { k: "language" } },
    { icon: <HelpIcon s={20} c="var(--blue)" />, label: "Help & support", sub: "Call or WhatsApp", to: { k: "support" } },
  ];
  return (
    <div className="fade-up" style={{ padding: "0 16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 2px 16px" }}>
        <Avatar initials={initials(me.name)} size={58} />
        <div>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{me.name}</p>
          <p style={{ ...small, margin: 0 }}>+91 {me.phone}</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[["Orders", orders.length], ["Cans with you", me.cansHeld], ["Wallet", inr(walletBalance(db, me.id))]].map(([k, v]) => (
          <div key={k as string} style={{ ...card, padding: "12px 8px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{v}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)" }}>{k}</p>
          </div>
        ))}
      </div>
      <div style={{ ...card, padding: 12, marginTop: 12, display: "flex", gap: 10, alignItems: "center", background: "var(--teal-bg)", boxShadow: "none" }}>
        <CanIcon s={22} c="var(--teal-text)" />
        <p style={{ ...small, margin: 0, color: "var(--text-secondary)" }}>You hold <b>{me.cansHeld}</b> reusable can{me.cansHeld === 1 ? "" : "s"}. Keep them ready — each delivery swaps full for empty.</p>
      </div>
      <div style={{ ...card, marginTop: 14, padding: "4px 0" }}>
        {menu.map((m, i) => (
          <button key={m.label} onClick={() => nav.push(m.to)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left", borderTop: i ? "1px solid var(--line)" : "none" }}>
            {m.icon}
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{m.label}</span>
            {m.sub && <span style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>{m.sub}</span>}
            <ChevronRight s={16} c="var(--ink-mute)" />
          </button>
        ))}
      </div>
      <button onClick={onLogout} className="press" style={{ ...card, width: "100%", marginTop: 14, padding: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, color: "var(--error-text)", fontWeight: 700, fontSize: 14 }}>
        <LogoutIcon s={20} c="var(--error-text)" /> Log out
      </button>
      <DemoLinks />
    </div>
  );
}

/** Jump between the four demo apps and reset the shared demo database. */
export function DemoLinks() {
  const [sure, setSure] = useState(false);
  const a: React.CSSProperties = { color: "var(--blue)", fontWeight: 700, textDecoration: "none" };
  return (
    <div style={{ marginTop: 18, padding: 12, borderRadius: 14, border: "1px dashed var(--line-strong)", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, textAlign: "center" }}>
      Demo · <Link href="/" style={a}>All apps</Link> · <Link href="/driver" style={a}>Driver</Link> · <Link href="/vendor" style={a}>Vendor</Link> · <Link href="/admin" style={a}>Admin</Link>
      <br />
      {sure
        ? <>Reset all demo data? <button onClick={() => { resetDemo(); setSure(false); }} style={{ ...a, background: "none", border: "none", cursor: "pointer", color: "var(--error-text)" }}>Yes, reset</button> · <button onClick={() => setSure(false)} style={{ ...a, background: "none", border: "none", cursor: "pointer" }}>No</button></>
        : <button onClick={() => setSure(true)} style={{ ...a, background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }}>Reset demo data</button>}
    </div>
  );
}

export function WalletPage({ me, nav }: { me: Customer; nav: Nav }) {
  const db = useData();
  const [amt, setAmt] = useState(500);
  const [upi, setUpi] = useState(false);
  const txns = db.wallet.filter((w) => w.customerId === me.id).sort((a, b) => b.at - a.at);
  const add = () => {
    update((d) => {
      d.wallet.unshift({ id: `w${Date.now()}`, customerId: me.id, amount: amt, title: "Added money · UPI", at: Date.now(), ref: `UPI${Date.now()}` });
      notify(d, `customer:${me.id}`, `${inr(amt)} added to wallet`, "Use it for faster checkout.");
    });
    setUpi(false);
    nav.flash(`${inr(amt)} added`);
  };
  return (
    <InfoPage title="Wallet" onBack={nav.back}>
      <div style={{ borderRadius: 20, padding: 18, background: "linear-gradient(150deg,var(--go-dark),var(--go-light))", color: "white" }}>
        <p style={{ margin: 0, fontSize: 12.5, opacity: 0.85 }}>Available balance</p>
        <p style={{ margin: "2px 0 0", fontSize: 30, fontWeight: 800 }}>{inr(walletBalance(db, me.id))}</p>
      </div>
      <div style={{ ...card, padding: 14 }}>
        <p style={label}>Add money</p>
        <div style={{ display: "flex", gap: 8 }}>{[200, 500, 1000, 2000].map((n) => <Chip key={n} on={amt === n} onClick={() => setAmt(n)}>{inr(n)}</Chip>)}</div>
        <PrimaryButton tone="go" onClick={() => setUpi(true)} style={{ marginTop: 12 }}>Add {inr(amt)}</PrimaryButton>
      </div>
      <h3 style={{ margin: "6px 2px 0", fontSize: 15, fontWeight: 700 }}>Transactions</h3>
      <div style={{ ...card, padding: "4px 14px" }}>
        {txns.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{t.title}</p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)" }}>{fmtDT(t.at)}</p>
            </div>
            <span style={{ fontWeight: 800, color: t.amount > 0 ? "var(--success-text)" : "var(--ink)" }}>{t.amount > 0 ? "+" : "−"}{inr(Math.abs(t.amount))}</span>
          </div>
        ))}
        {!txns.length && <p style={small}>No transactions yet.</p>}
      </div>
      {upi && <UpiSheet amount={amt} payee="Water Delivery wallet" onClose={() => setUpi(false)} onPaid={add} />}
    </InfoPage>
  );
}

export function NotificationsPage({ me, nav }: { me: Customer; nav: Nav }) {
  const db = useData();
  const to = `customer:${me.id}`;
  const list = db.notices.filter((n) => n.to === to);
  const open = (id: string, orderId?: string) => {
    update((d) => { const n = d.notices.find((x) => x.id === id); if (n) n.read = true; });
    if (orderId) nav.push({ k: "track", id: orderId });
  };
  return (
    <InfoPage title="Notifications" onBack={nav.back} right={list.some((n) => !n.read) ? <button onClick={() => update((d) => { d.notices.forEach((n) => { if (n.to === to) n.read = true; }); })} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Mark all read</button> : undefined}>
      {list.map((n) => (
        <button key={n.id} onClick={() => open(n.id, n.orderId)} className="press" style={{ ...card, border: "none", textAlign: "left", cursor: "pointer", padding: 14, display: "flex", gap: 10, background: n.read ? "var(--surface)" : "var(--blue-tint)" }}>
          {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", marginTop: 6, flexShrink: 0 }} />}
          <div>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{n.title}</p>
            <p style={small}>{n.body}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--ink-mute)" }}>{fmtDT(n.at)}</p>
          </div>
        </button>
      ))}
      {!list.length && <Empty title="You're all caught up" />}
    </InfoPage>
  );
}

export function LanguagePage({ me, nav }: { me: Customer; nav: Nav }) {
  const db = useData();
  return (
    <InfoPage title="Language" onBack={nav.back}>
      {db.settings.languages.filter((l) => l.enabled).map((l) => (
        <button key={l.code} onClick={() => { update((d) => { d.customers.find((c) => c.id === me.id)!.lang = l.code; }); nav.flash(`Language: ${l.name}`); }}
          className="press" style={{ ...card, border: `1.5px solid ${me.lang === l.code ? "var(--blue)" : "transparent"}`, padding: 16, textAlign: "left", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          {l.name} {me.lang === l.code && <span style={{ float: "right", color: "var(--blue)" }}>✓</span>}
        </button>
      ))}
      <p style={small}>More languages are switched on by the platform as we launch in new regions.</p>
    </InfoPage>
  );
}

export function SupportPage({ nav }: { nav: Nav }) {
  const db = useData();
  const faq = [
    ["How does can exchange work?", "Every delivery of a reusable can swaps it for an empty one. First-time cans carry a refundable deposit."],
    ["Can I choose my vendor?", "No — we automatically assign the nearest available partner so you get water fastest."],
    ["When can I cancel?", `Free until the driver ${db.settings.freeCancelUntil === "Accepted" ? "accepts" : "is on the way"}. After that a ${inr(db.settings.cancelFee)} fee may apply.`],
    ["How do refunds work?", "Refunds for prepaid orders are processed by our support team, usually within 2–3 working days."],
  ];
  return (
    <InfoPage title="Help & Support" onBack={nav.back}>
      <div style={{ display: "flex", gap: 10 }}>
        <a href={`tel:${db.settings.support.phone}`} style={{ ...card, flex: 1, padding: 16, textAlign: "center", textDecoration: "none", color: "var(--ink)" }}><PhoneIcon s={24} c="var(--blue)" /><p style={{ margin: "6px 0 0", fontWeight: 700, fontSize: 13.5 }}>Call us</p><p style={{ ...small, fontSize: 11 }}>{db.settings.support.phone}</p></a>
        <a href={`https://wa.me/${db.settings.support.whatsapp}`} target="_blank" rel="noreferrer" style={{ ...card, flex: 1, padding: 16, textAlign: "center", textDecoration: "none", color: "var(--ink)" }}><WhatsAppIcon s={24} c="var(--go)" /><p style={{ margin: "6px 0 0", fontWeight: 700, fontSize: 13.5 }}>WhatsApp</p><p style={{ ...small, fontSize: 11 }}>Chat with us</p></a>
      </div>
      {faq.map(([q, a]) => <div key={q} style={{ ...card, padding: 14 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{q}</p><p style={small}>{a}</p></div>)}
    </InfoPage>
  );
}

export function EditProfilePage({ me, nav }: { me: Customer; nav: Nav }) {
  const [name, setName] = useState(me.name);
  const ok = name.trim().length >= 2;
  return (
    <div className="fade-up">
      <InfoPage title="Edit Profile" onBack={nav.back}>
        <div><label style={label} htmlFor="p-name">Full name</label><input id="p-name" value={name} onChange={(e) => setName(e.target.value)} style={field} /></div>
        <div><label style={label} htmlFor="p-phone">Mobile number</label><input id="p-phone" value={`+91 ${me.phone}`} disabled style={{ ...field, color: "var(--ink-mute)" }} /><p style={{ ...small, fontSize: 11 }}>Your mobile number is your login and can&apos;t be changed here.</p></div>
      </InfoPage>
      <Footer><PrimaryButton disabled={!ok} onClick={() => { update((d) => { d.customers.find((c) => c.id === me.id)!.name = name.trim(); }); nav.flash("Profile updated"); nav.back(); }}>Save</PrimaryButton></Footer>
    </div>
  );
}
