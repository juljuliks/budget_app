// The dynamics of a category's spending: this week / month so far against its usual one by the same days, the bars of
// the charts, the habits by weekday, the merchants. Pure: counted from db/plans/trendsData.
import type { TrendSpend } from '../db/plans';
import { DayKey, dayKeyOf, daysInMonth, parseDayKey } from '@/shared/lib/dateRange';

export type TrendMode = 'week' | 'month';
/** How many past weeks / months the usual spending is the median of. */
export const USUAL_OF = { week: 8, month: 3 } as const;
/** A change worth showing: at least this % of the usual… */
export const NOTABLE_PCT = 30;
/** …and at least this much (minor units of the currency shown). */
export const NOTABLE_MIN = { week: 1500, month: 3000 } as const;

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

/** This week / month up to today, and the same days of each of the past USUAL_OF weeks / months (the 30th: the last day of a shorter one). */
export function trendWindows(mode: TrendMode, today: DayKey): { cur: Window; past: Window[] } {
  if (mode === 'week') {
    const monday = weekStartOf(today);
    const len = Math.round((parseDayKey(today).getTime() - parseDayKey(monday).getTime()) / 86400000);
    const past = Array.from({ length: USUAL_OF.week }, (_, i) => {
      const from = addDays(monday, -7 * (i + 1));
      return { from, to: addDays(from, len) };
    });
    return { cur: { from: monday, to: today }, past };
  }
  const d = parseDayKey(today);
  const past = Array.from({ length: USUAL_OF.month }, (_, i) => {
    const first = dayKeyOf(new Date(d.getFullYear(), d.getMonth() - (i + 1), 1));
    const last = Math.min(d.getDate(), daysInMonth(ymOfDay(first)));
    return { from: first, to: `${ymOfDay(first)}-${String(last).padStart(2, '0')}` };
  });
  return { cur: { from: `${ymOfDay(today)}-01`, to: today }, past };
}

export type Trend = {
  /** spent this week / month so far */
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

/** One category's spending (`spends` are its own) against its usual; null — not tracked long enough for a usual one (`since`). */
export function trendOf(spends: TrendSpend[], mode: TrendMode, today: DayKey, since: DayKey | null): Trend | null {
  const { cur, past } = trendWindows(mode, today);
  if (!since || since > past[past.length - 1].from) return null;
  const c = sumIn(spends, cur);
  const usual = median(past.map((w) => sumIn(spends, w)));
  const delta = c - usual;
  const pct = usual > 0 ? Math.round((delta / usual) * 100) : null;
  return {
    cur: c, usual, delta, pct,
    count: countIn(spends, cur), usualCount: Math.round(median(past.map((w) => countIn(spends, w)))),
    notable: Math.abs(delta) >= NOTABLE_MIN[mode] && (pct === null || Math.abs(pct) >= NOTABLE_PCT),
  };
}

/** This week by day, Monday first: spent each day (null — not yet), and usually on that weekday (median of the past weeks). */
export function weekBars(spends: TrendSpend[], today: DayKey): Array<{ day: DayKey; value: number | null; usual: number }> {
  const monday = weekStartOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    const usual = median(Array.from({ length: USUAL_OF.week }, (_, w) => sumIn(spends, { from: addDays(day, -7 * (w + 1)), to: addDays(day, -7 * (w + 1)) })));
    return { day, value: day > today ? null : sumIn(spends, { from: day, to: day }), usual };
  });
}

/** The last `count` months, oldest first ('YYYY-MM'), the current one so far. */
export function monthBars(spends: TrendSpend[], today: DayKey, count = 12): Array<{ ym: string; value: number }> {
  const d = parseDayKey(today);
  const yms = Array.from({ length: count }, (_, i) => ymOfDay(dayKeyOf(new Date(d.getFullYear(), d.getMonth() - (count - 1 - i), 1))));
  const by = new Map(yms.map((ym) => [ym, 0]));
  for (const s of spends) { const ym = ymOfDay(s.day); if (by.has(ym)) by.set(ym, by.get(ym)! + s.value); }
  return yms.map((ym) => ({ ym, value: by.get(ym)! }));
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

/** The merchants of this week / month so far by their spending, most first. */
export function topMerchants(spends: TrendSpend[], mode: TrendMode, today: DayKey, count = 3): Array<{ key: string | null; name: string; value: number }> {
  const { cur } = trendWindows(mode, today);
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
