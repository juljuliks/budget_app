import { Db, getDb } from './index';
import { fetchRates } from '../fx/nbg';
import { placeholders } from './sql';
import { emitTransactionsChanged } from '../domain/events';

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

const FOREIGN = CURRENCIES.filter((c) => c !== 'GEL');

/** At most this many days are fetched per call (the rest use the nearest cached day until next time). */
const MAX_FETCH = 40;
const PARALLEL = 4;

/** The days among these whose rates aren't cached yet, latest first, at most MAX_FETCH (future days count as today). */
async function missingRates(dates: Iterable<string>): Promise<string[]> {
  const today = dateKey(Date.now() / 1000);
  const wanted = [...new Set([...dates].map((d) => (d > today ? today : d)))];
  if (wanted.length === 0) return [];
  const have = new Set((await (await getDb()).all<{ date: string }>(
    `SELECT date FROM fx_rates WHERE currency = ? AND date IN (${placeholders(wanted.length)})`,
    [FOREIGN[0], ...wanted])).map((r) => r.date));
  return wanted.filter((d) => !have.has(d)).sort().reverse().slice(0, MAX_FETCH);
}

/** Fetches and caches these days' rates; how many days came. Network errors are ignored (logged). */
async function fetchDays(days: string[]): Promise<number> {
  const db = await getDb();
  let came = 0;
  for (let i = 0; i < days.length; i += PARALLEL) {
    await Promise.all(days.slice(i, i + PARALLEL).map(async (date) => {
      try {
        const rates = (await fetchRates(date, FOREIGN)).filter((r) => isCurrency(r.code));
        for (const r of rates) {
          await db.run('INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, ?, ?)', [date, r.code, r.gelPerUnit]);
        }
        if (rates.length > 0) came++;
      } catch (e) {
        console.warn('rates for', date, 'not loaded', e);
      }
    }));
  }
  return came;
}

/**
 * Makes sure the rates of these days are cached, fetching the missing ones (future days count as today).
 * Network errors are ignored: conversion then falls back to the nearest cached day.
 */
export async function ensureRates(dates: Iterable<string>): Promise<void> {
  await fetchDays(await missingRates(dates));
}

/** Days being fetched in the background: asked again meanwhile (another query of the same screen), not fetched twice. */
const fetching = new Set<string>();

/**
 * The stats' way: they are counted on the cached rates (a missing day takes its neighbour's) and don't wait for the
 * network. The missing days are fetched in the background; once some came, `onFetched` — the screens count again.
 */
export async function ensureRatesLater(dates: Iterable<string>, onFetched: () => void = emitTransactionsChanged): Promise<void> {
  const days = (await missingRates(dates)).filter((d) => !fetching.has(d));
  if (days.length === 0) return;
  days.forEach((d) => fetching.add(d));
  fetchDays(days)
    .then((came) => { if (came > 0) onFetched(); })
    .catch((e) => console.warn('rates not loaded', e))
    .finally(() => days.forEach((d) => fetching.delete(d)));
}

/** Converts minor units from one currency to another on a day; null when no rate is known at all. */
export type Converter = (amountMinor: number, from: string, to: string, date: string) => number | null;

/**
 * A converter over the cached rates: the rate of that day, else the nearest earlier one, else the nearest later
 * one (weekends and days not fetched yet take a neighbour's rate).
 */
export async function makeConverter(): Promise<Converter> {
  const db = await getDb();
  // the table only grows (INSERT OR REPLACE gives a replaced row a new rowid): its count and last rowid tell a change
  const s = await db.get<{ n: number; last: number | null }>('SELECT count(*) AS n, max(rowid) AS last FROM fx_rates');
  const stamp = `${s?.n}|${s?.last}`;
  if (cached?.db === db && cached.stamp === stamp) return cached.conv;
  const conv = await buildConverter(db);
  cached = { db, stamp, conv };
  return conv;
}

/** The last converter built, on which connection and state of fx_rates. */
let cached: { db: Db; stamp: string; conv: Converter } | null = null;

async function buildConverter(db: Db): Promise<Converter> {
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

export default { CURRENCIES, ensureRates, ensureRatesLater, makeConverter, dateKey };
