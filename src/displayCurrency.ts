import { useEffect, useState } from 'react';
import { getSetting, setSetting } from './db/settings';
import { Currency, isCurrency } from './db/fx';

// The currency amounts are converted to across the app (stats, plan, history, day totals and day stats), picked
// in Настройки → Валюта and remembered. Every screen using it follows a change at once.

const KEY = 'display_currency';
let current: Currency = 'GEL';
let loaded = false;
const listeners = new Set<(c: Currency) => void>();

async function load() {
  if (loaded) return;
  loaded = true;
  const v = await getSetting(KEY);
  if (isCurrency(v) && v !== current) {
    current = v;
    listeners.forEach((fn) => fn(v));
  }
}

export async function setDisplayCurrency(c: Currency) {
  current = c;
  listeners.forEach((fn) => fn(c));
  await setSetting(KEY, c);
}

export function useDisplayCurrency(): Currency {
  const [c, setC] = useState<Currency>(current);
  useEffect(() => {
    listeners.add(setC);
    load().catch((e) => console.error('load display currency failed', e));
    setC(current);
    return () => { listeners.delete(setC); };
  }, []);
  return c;
}
