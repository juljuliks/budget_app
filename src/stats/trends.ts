// The dynamics of a category's spending: this month so far against its usual one by the same days, the bars of the
// charts, the habits by weekday, the merchants. Pure: counted from db/plans/trendsData.
import type { TrendSpend } from '../db/plans';
import { DayKey, dayKeyOf, daysInMonth, parseDayKey } from '@/shared/lib/dateRange';

/** How many past months the usual spending is the median of (those tracked)… */
export const USUAL_MONTHS = 6;
/** …at least this many: fewer — no usual yet */
export const USUAL_MIN_MONTHS = 3;
/** A change worth showing: at least this % of the usual… */
export const NOTABLE_PCT = 30;
/** …and at least this much (minor units of the currency shown)… */
export const NOTABLE_MIN = 3000;
// …and past each of the tracked months by the same days (more than the most or less than the least): early in a month
// its few days swing from month to month, and one purchase isn't a change

type Window = { from: DayKey; to: DayKey };

const addDays = (k: DayKey, n: number): DayKey => { const d = parseDayKey(k); d.setDate(d.getDate() + n); return dayKeyOf(d); };
/** The Monday of the week of `k`. */
export const weekStartOf = (k: DayKey): DayKey => addDays(k, -((parseDayKey(k).getDay() + 6) % 7));
const ymOfDay = (k: DayKey) => k.slice(0, 7);
const inWindow = (day: DayKey, w: Window) => day >= w.from && day <= w.to;

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** This month up to today, and the same days of each of the past USUAL_MONTHS months, the latest first (the 30th: the last day of a shorter one). */
export function trendWindows(today: DayKey): { cur: Window; past: Window[] } {
  const d = parseDayKey(today);
  const past = Array.from({ length: USUAL_MONTHS }, (_, i) => {
    const first = dayKeyOf(new Date(d.getFullYear(), d.getMonth() - (i + 1), 1));
    const last = Math.min(d.getDate(), daysInMonth(ymOfDay(first)));
    return { from: first, to: `${ymOfDay(first)}-${String(last).padStart(2, '0')}` };
  });
  return { cur: { from: `${ymOfDay(today)}-01`, to: today }, past };
}

export type Trend = {
  /** spent this month so far */
  cur: number;
  /** usually by the same days */
  usual: number;
  delta: number;
  /** % of the usual; null — nothing usually */
  pct: number | null;
  /** purchases (operations that added to the spending) this time and usually */
  count: number; usualCount: number;
  /** worth showing (NOTABLE_PCT and NOTABLE_MIN) */
  notable: boolean;
};

const sumIn = (spends: TrendSpend[], w: Window) => spends.reduce((a, s) => (inWindow(s.day, w) ? a + s.value : a), 0);
const countIn = (spends: TrendSpend[], w: Window) => spends.filter((s) => s.value > 0 && inWindow(s.day, w)).length;

/**
 * One category's spending (`spends` are its own) against its usual: the median of the tracked past months (`since`) by
 * the same days; null — fewer than USUAL_MIN_MONTHS of them.
 */
export function trendOf(spends: TrendSpend[], today: DayKey, since: DayKey | null): Trend | null {
  const { cur, past: all } = trendWindows(today);
  const past = since ? all.filter((w) => w.from >= since) : [];
  if (past.length < USUAL_MIN_MONTHS) return null;
  const c = sumIn(spends, cur);
  const sums = past.map((w) => sumIn(spends, w));
  const usual = median(sums);
  const delta = c - usual;
  const pct = usual > 0 ? Math.round((delta / usual) * 100) : null;
  const outside = c > Math.max(...sums) || c < Math.min(...sums);
  return {
    cur: c, usual, delta, pct,
    count: countIn(spends, cur), usualCount: Math.round(median(past.map((w) => countIn(spends, w)))),
    notable: outside && Math.abs(delta) >= NOTABLE_MIN && (pct === null || Math.abs(pct) >= NOTABLE_PCT),
  };
}

/** The last `count` months, oldest first ('YYYY-MM'), the current one so far. */
export function monthBars(spends: TrendSpend[], today: DayKey, count = 12): Array<{ ym: string; value: number }> {
  const d = parseDayKey(today);
  const yms = Array.from({ length: count }, (_, i) => ymOfDay(dayKeyOf(new Date(d.getFullYear(), d.getMonth() - (count - 1 - i), 1))));
  const by = new Map(yms.map((ym) => [ym, 0]));
  for (const s of spends) { const ym = ymOfDay(s.day); if (by.has(ym)) by.set(ym, by.get(ym)! + s.value); }
  return yms.map((ym) => ({ ym, value: by.get(ym)! }));
}

/** This week by day, Monday first: spent each day so far (null — a day to come). */
export function thisWeek(spends: TrendSpend[], today: DayKey): Array<number | null> {
  const monday = weekStartOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return day > today ? null : sumIn(spends, { from: day, to: day });
  });
}

/** Spent on average each weekday, Monday first, over the `weeks` full weeks before this one (those since tracking began). */
export function weekdayHabits(spends: TrendSpend[], today: DayKey, since: DayKey | null, weeks = 13): number[] {
  const monday = weekStartOf(today);
  let from = addDays(monday, -7 * weeks);
  if (since && since > from) from = weekStartOf(addDays(since, 6));
  const n = Math.max(0, Math.round((parseDayKey(monday).getTime() - parseDayKey(from).getTime()) / (7 * 86400000)));
  const sums = Array(7).fill(0);
  for (const s of spends) if (s.day >= from && s.day < monday) sums[(parseDayKey(s.day).getDay() + 6) % 7] += s.value;
  return sums.map((v) => (n ? v / n : 0));
}

/** The merchants of this month so far by their spending, most first. */
export function topMerchants(spends: TrendSpend[], today: DayKey, count = 3): Array<{ key: string | null; name: string; value: number }> {
  const { cur } = trendWindows(today);
  const by = new Map<string, { key: string | null; name: string; value: number }>();
  for (const s of spends) {
    if (!inWindow(s.day, cur) || !s.merchant) continue;
    const id = s.merchantKey ?? s.merchant;
    const m = by.get(id) ?? { key: s.merchantKey, name: s.merchant, value: 0 };
    m.value += s.value;
    by.set(id, m);
  }
  return [...by.values()].filter((m) => m.value > 0).sort((a, b) => b.value - a.value).slice(0, count);
}

/** Over the full months of `bars` (not the current one) since tracking began: the average, the least and the most. */
export function monthsSummary(bars: Array<{ ym: string; value: number }>, since: DayKey | null) {
  // a month tracking began after its 1st isn't full either
  const full = bars.slice(0, -1).filter((b) => since !== null && `${b.ym}-01` >= since);
  if (full.length === 0) return null;
  const least = full.reduce((a, b) => (b.value < a.value ? b : a));
  const most = full.reduce((a, b) => (b.value > a.value ? b : a));
  return { average: full.reduce((a, b) => a + b.value, 0) / full.length, total: bars.reduce((a, b) => a + b.value, 0), least, most };
}
