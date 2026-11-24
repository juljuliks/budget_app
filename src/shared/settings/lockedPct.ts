import { useEffect, useState } from 'react';
import { lockedPctSetting, setLockedPct } from '@/db/plans';
import { emitTransactionsChanged } from '@/domain/events';

// «🔒 Отложить сразу», % of the month's budget (Настройки → Бюджет): null — not set. Every screen using it follows a
// change at once; a change counts the months' 🔒 anew (setLockedPct).

let current: number | null = null;
let loaded = false;
const listeners = new Set<(v: number | null) => void>();

async function load() {
  if (loaded) return;
  loaded = true;
  const v = await lockedPctSetting();
  if (v !== current) {
    current = v;
    listeners.forEach((fn) => fn(v));
  }
}

/** Saves the % and applies it to the months (the stats reload). */
export async function saveLockedPct(pct: number) {
  loaded = true;
  current = pct;
  listeners.forEach((fn) => fn(pct));
  await setLockedPct(pct);
  emitTransactionsChanged();
}

/** Forgets what was read (tests: a fresh database). */
export function resetLockedPct() {
  loaded = false;
  current = null;
}

export function useLockedPct(): number | null {
  const [v, setV] = useState(current);
  useEffect(() => {
    listeners.add(setV);
    load().catch((e) => console.error('load locked pct failed', e));
    setV(current);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}
