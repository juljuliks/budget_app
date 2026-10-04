import { useEffect, useState } from 'react';
import { getSetting, setSetting } from './db/settings';
import { Currency, isCurrency } from './db/fx';

// Currencies amounts are shown in, picked by the user and remembered: one for the Статистика tab (stats, plan,
// history) and one for the transactions list (day totals, day stats). Every screen using one follows a change.

export type CurrencyScope = 'stats' | 'transactions';

const KEYS: Record<CurrencyScope, string> = { stats: 'stats_currency', transactions: 'transactions_currency' };
const current: Record<CurrencyScope, Currency> = { stats: 'GEL', transactions: 'GEL' };
const loaded = new Set<CurrencyScope>();
const listeners: Record<CurrencyScope, Set<(c: Currency) => void>> = { stats: new Set(), transactions: new Set() };

async function load(scope: CurrencyScope) {
  if (loaded.has(scope)) return;
  loaded.add(scope);
  const v = await getSetting(KEYS[scope]);
  if (isCurrency(v) && v !== current[scope]) {
    current[scope] = v;
    listeners[scope].forEach((fn) => fn(v));
  }
}

export async function setDisplayCurrency(scope: CurrencyScope, c: Currency) {
  current[scope] = c;
  listeners[scope].forEach((fn) => fn(c));
  await setSetting(KEYS[scope], c);
}

export function useDisplayCurrency(scope: CurrencyScope): Currency {
  const [c, setC] = useState<Currency>(current[scope]);
  useEffect(() => {
    listeners[scope].add(setC);
    load(scope).catch((e) => console.error('load display currency failed', e));
    setC(current[scope]);
    return () => { listeners[scope].delete(setC); };
  }, [scope]);
  return c;
}
