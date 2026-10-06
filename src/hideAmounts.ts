import { useEffect, useState } from 'react';
import { getSetting, setSetting } from './db/settings';

// "Скрыть суммы" (the eye in the stats header): the budget and plan totals are blurred, e.g. to show the stats to
// someone. Remembered, and every screen using it follows a change at once.

const KEY = 'hide_amounts';
let current = false;
let loaded = false;
const listeners = new Set<(v: boolean) => void>();

async function load() {
  if (loaded) return;
  loaded = true;
  const v = (await getSetting(KEY)) === '1';
  if (v !== current) {
    current = v;
    listeners.forEach((fn) => fn(v));
  }
}

export async function setHideAmounts(v: boolean) {
  current = v;
  listeners.forEach((fn) => fn(v));
  await setSetting(KEY, v ? '1' : '0');
}

export function useHideAmounts(): boolean {
  const [v, setV] = useState(current);
  useEffect(() => {
    listeners.add(setV);
    load().catch((e) => console.error('load hide amounts failed', e));
    setV(current);
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}
