// What a category's «Динамика» is, by how often it is spent on (not by the month's plan: that changes every month),
// and for a rare one (rent, insurance, a dentist) — its payments over the year.
import type { TrendCategory, TrendSpend } from '../db/plans';
import { DayKey, dayKeyOf, parseDayKey } from '../shared/lib/dateRange';
import { median, monthBars } from './trends';

/**
 * none — a transfer one (no «Динамика»); fund — it has a fund; subs — «Подписки» on (several merchants a month, each
 * once: frequency can't tell); rare — 1–2 operations in a month spent in, or fewer; frequent — 3 and more (as before);
 * few — too few months to tell: the frequent page, «Мало данных» over it (not guessed from the plan).
 */
export type TrendKind = 'none' | 'fund' | 'subs' | 'rare' | 'frequent' | 'few';

/** the full months before this one counted for the frequency */
export const KIND_MONTHS = 6;
/** fewer full months spent in: too little to tell (few) */
export const KIND_MIN_MONTHS = 2;
/** a month's operations (the median) up to which it is rare; 2.5 (between 2 and 3) is frequent: no flip at the border */
const RARE_UP_TO = 2;
/** payments this close to the one before are one amount (a run); "сумма почти одна" (rent) — at most two runs */
const SAME_AMOUNT = 0.1;
/** the payments looked at for it */
const STABLE_OF = 6;
/** a change of the amount below this is noise (a rate): not «Подорожал» */
const CHANGE_MIN = 0.02;

const ymOfDay = (d: DayKey) => d.slice(0, 7);
const ymBack = (today: DayKey, n: number) => { const d = parseDayKey(today); return ymOfDay(dayKeyOf(new Date(d.getFullYear(), d.getMonth() - n, 1))); };

/** One operation (its parts in the category together), the newest first. */
export type Payment = { tx: number | null; day: DayKey; value: number; merchant: string | null; merchantKey: string | null };

export function paymentsOf(spends: TrendSpend[]): Payment[] {
  const by = new Map<string, Payment>();
  spends.forEach((s, i) => {
    if (s.value <= 0) return;
    const id = s.tx !== undefined ? `t${s.tx}` : `i${i}`;
    const had = by.get(id);
    by.set(id, had ? { ...had, value: had.value + s.value } : { tx: s.tx ?? null, day: s.day, value: s.value, merchant: s.merchant, merchantKey: s.merchantKey });
  });
  return [...by.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

export function trendKind(c: TrendCategory, spends: TrendSpend[], today: DayKey): TrendKind {
  if (c.transfer) return 'none';
  if (c.fund) return 'fund';
  if (c.subs) return 'subs';
  const months = new Set(Array.from({ length: KIND_MONTHS }, (_, i) => ymBack(today, i + 1)));
  const counts = new Map<string, number>();
  for (const p of paymentsOf(spends)) {
    const ym = ymOfDay(p.day);
    if (months.has(ym)) counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }
  if (counts.size < KIND_MIN_MONTHS) return 'few';
  return median([...counts.values()]) > RARE_UP_TO ? 'frequent' : 'rare';
}

/** A month's average from the first month spent in (not over 12 when it began this spring). */
export function averageSince(bars: Array<{ value: number }>): number {
  const first = bars.findIndex((b) => b.value > 0);
  return first < 0 ? 0 : bars.reduce((a, b) => a + b.value, 0) / (bars.length - first);
}

/** A change of a payment's amount: from, to, the month of the first one at the new amount. */
export type Change = { from: number; to: number; ym: string };

/** The latest change of the amount among payments, the newest first; null — none worth saying. */
export function lastChange(ps: Array<{ value: number; day: DayKey }>): Change | null {
  for (let i = 0; i + 1 < ps.length; i++) {
    const [cur, prev] = [ps[i].value, ps[i + 1].value];
    if (Math.abs(cur - prev) > prev * CHANGE_MIN) return { from: prev, to: cur, ym: ymOfDay(ps[i].day) };
  }
  return null;
}

/** «Динамика» of a rare category: the 12 months, its payments and, when the amount is nearly the same, how it changed. */
export function rareTrend(spends: TrendSpend[], today: DayKey) {
  const bars = monthBars(spends, today);
  const from = `${bars[0].ym}-01`;
  const payments = paymentsOf(spends).filter((p) => p.day >= from);
  // the latest payments in runs of nearly the same amount: one run — the same; two — the amount changed once
  const recent = payments.slice(0, STABLE_OF).map((p) => p.value);
  const runs = recent.reduce((n, v, i) => (i > 0 && Math.abs(v - recent[i - 1]) > recent[i - 1] * SAME_AMOUNT ? n + 1 : n), 1);
  const stable = recent.length >= 2 && (runs === 1 || (runs === 2 && recent.length >= 3));
  const days = payments.slice(0, 6).map((p) => Number(p.day.slice(8)));
  const total = bars.reduce((a, b) => a + b.value, 0);
  const paidMonths = bars.filter((b) => b.value > 0).length;
  return {
    bars,
    payments,
    total,
    average: averageSince(bars),
    /** "сумма почти одна": «Подорожал», «Обычно списывается», «+200 ₾ к прошлому» */
    stable,
    change: stable ? lastChange(payments) : null,
    /** "3–5 числа": when it is charged within a week of the month */
    days: stable && days.length >= 2 && Math.max(...days) - Math.min(...days) <= 7 ? { from: Math.min(...days), to: Math.max(...days) } : null,
    paidMonths,
    /** "раз в 3 месяца": twelve months over the payments */
    every: payments.length >= 2 ? Math.max(1, Math.round(bars.length / payments.length)) : null,
  };
}

export type RareTrend = ReturnType<typeof rareTrend>;
