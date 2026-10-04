import { getDb } from './index';

// Currencies and conversion. Amounts are stored in their own currency; stats are shown in one the user picks,
// converted with the official rate of the transaction's day (National Bank of Georgia, GEL per unit), cached
// in fx_rates. Only the dates and currency codes are requested — nothing about the user leaves the phone.

export const CURRENCIES = ['GEL', 'USD', 'EUR'] as const;
export type Currency = typeof CURRENCIES[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = { GEL: '₾', USD: '$', EUR: '€' };

export function isCurrency(v: string | null | undefined): v is Currency {
  return !!v && (CURRENCIES as readonly string[]).includes(v);
}

/** Local calendar day of a unix time, "2026-10-04". */
export function dateKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const NBG_URL = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';
const FOREIGN = CURRENCIES.filter((c) => c !== 'GEL');

type NbgDay = Array<{ currencies: Array<{ code: string; quantity: number; rate: number }> }>;
type Fetcher = (url: string) => Promise<unknown>;

let fetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rates ${res.status}`);
  return res.json();
};

/** Tests (no network) replace the HTTP call. */
export function setRatesFetcher(f: Fetcher) {
  fetcher = f;
}

/** At most this many days are fetched per call (the rest use the nearest cached day until next time). */
const MAX_FETCH = 40;
const PARALLEL = 4;

/**
 * Makes sure the rates of these days are cached, fetching the missing ones (future days count as today).
 * Network errors are ignored: conversion then falls back to the nearest cached day.
 */
export async function ensureRates(dates: Iterable<string>): Promise<void> {
  const db = await getDb();
  const today = dateKey(Date.now() / 1000);
  const wanted = [...new Set([...dates].map((d) => (d > today ? today : d)))];
  if (wanted.length === 0) return;
  const have = new Set((await db.all<{ date: string }>(
    `SELECT date FROM fx_rates WHERE currency = ? AND date IN (${wanted.map(() => '?').join(',')})`,
    [FOREIGN[0], ...wanted])).map((r) => r.date));
  const missing = wanted.filter((d) => !have.has(d)).sort().reverse().slice(0, MAX_FETCH);
  for (let i = 0; i < missing.length; i += PARALLEL) {
    await Promise.all(missing.slice(i, i + PARALLEL).map(async (date) => {
      try {
        const query = FOREIGN.map((c) => `currencies=${c}`).join('&');
        const days = (await fetcher(`${NBG_URL}?${query}&date=${date}`)) as NbgDay;
        for (const c of days?.[0]?.currencies ?? []) {
          if (!isCurrency(c.code) || !(c.rate > 0)) continue;
          await db.run('INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, ?, ?)',
            [date, c.code, c.rate / (c.quantity || 1)]);
        }
      } catch (e) {
        console.warn('rates for', date, 'not loaded', e);
      }
    }));
  }
}

/** Converts minor units from one currency to another on a day; null when no rate is known at all. */
export type Converter = (amountMinor: number, from: string, to: string, date: string) => number | null;

/**
 * A converter over the cached rates: the rate of that day, else the nearest earlier one, else the nearest later
 * one (weekends and days not fetched yet take a neighbour's rate).
 */
export async function makeConverter(): Promise<Converter> {
  const db = await getDb();
  const rows = await db.all<{ date: string; currency: string; gel_per_unit: number }>(
    'SELECT date, currency, gel_per_unit FROM fx_rates ORDER BY date');
  const byCurrency = new Map<string, Array<[string, number]>>();
  for (const r of rows) {
    if (!byCurrency.has(r.currency)) byCurrency.set(r.currency, []);
    byCurrency.get(r.currency)!.push([r.date, r.gel_per_unit]);
  }
  const rate = (currency: string, date: string): number | null => {
    if (currency === 'GEL') return 1;
    const list = byCurrency.get(currency);
    if (!list || list.length === 0) return null;
    let lo = 0, hi = list.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid][0] <= date) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return list[best >= 0 ? best : 0][1];
  };
  return (amount, from, to, date) => {
    if (from === to) return amount;
    const a = rate(from, date), b = rate(to, date);
    if (a === null || b === null) return null;
    return Math.round((amount * a) / b);
  };
}

export default { CURRENCIES, ensureRates, makeConverter, dateKey, setRatesFetcher };
