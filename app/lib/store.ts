"use client";

/* Demo backend: one JSON database in localStorage, shared by every app and
 * kept in sync across browser tabs through the `storage` event. Open the
 * customer app and the driver app side by side and they talk to each other.
 *
 * When Supabase is wired in, `useData()` becomes a query + realtime
 * subscription and `update()` calls become RPCs — screens don't change. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { DB_VERSION, seed } from "./seed";
import type { DB } from "./types";

const KEY = "aqua:db";
const REV = "aqua:rev";

let db: DB | null = null;
let rev = "";
const listeners = new Set<() => void>();

function readStored(): { db: DB | null; rev: string } {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DB) : null;
    return { db: parsed && parsed.version === DB_VERSION ? parsed : null, rev: localStorage.getItem(REV) ?? "" };
  } catch { return { db: null, rev: "" }; }
}

function persist() {
  rev = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try { localStorage.setItem(KEY, JSON.stringify(db)); localStorage.setItem(REV, rev); } catch { /* storage full or blocked — stays in memory */ }
}

function ensure(): DB {
  if (!db) {
    const s = readStored();
    if (s.db) { db = s.db; rev = s.rev; } else { db = seed(); persist(); }
  }
  return db;
}

/** Pull in writes another tab made since we last looked. */
function pull() {
  try {
    const r = localStorage.getItem(REV) ?? "";
    if (r && r !== rev) { const s = readStored(); if (s.db) { db = s.db; rev = r; return true; } }
  } catch { /* storage blocked */ }
  return false;
}

const emit = () => listeners.forEach((l) => l());

function onStorage(e: StorageEvent) {
  if (e.key === REV || e.key === null) { if (pull()) emit(); }
}

function subscribe(l: () => void) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(l);
  return () => { listeners.delete(l); if (!listeners.size) window.removeEventListener("storage", onStorage); };
}

/** Null during server render — shells show a splash until the client has data. */
export function useDB(): DB | null {
  return useSyncExternalStore(subscribe, ensure, () => null);
}

/** For screens rendered inside a shell that already waited for `useDB()`. */
export function useData(): DB {
  return useSyncExternalStore(subscribe, ensure, ensure);
}

export const getDB = () => ensure();

/**
 * Apply a change. The callback mutates a fresh copy; return `false` to abort
 * without saving. Always re-reads other tabs' writes first, so decisions are
 * made on the latest state.
 */
export function update(fn: (d: DB) => void | false) {
  ensure();
  pull();
  const next = structuredClone(db!);
  if (fn(next) === false) return;
  db = next;
  persist();
  emit();
}

export function resetDemo() {
  db = seed();
  persist();
  emit();
}

/** Re-renders every `ms` — for countdowns and moving map markers. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/* Per-app login sessions (demo). */
export const session = {
  get(app: string) { try { return localStorage.getItem(`aqua:session:${app}`); } catch { return null; } },
  set(app: string, id: string | null) {
    try { if (id) localStorage.setItem(`aqua:session:${app}`, id); else localStorage.removeItem(`aqua:session:${app}`); } catch { /* storage blocked */ }
  },
};
