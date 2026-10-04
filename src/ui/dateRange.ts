// Day / period helpers for the date filter (no React, usable from Node tests).

/** Local calendar day as 'YYYY-MM-DD' (string compare = chronological). */
export type DayKey = string;
export type DayRange = { from: DayKey; to: DayKey };

const p2 = (n: number) => String(n).padStart(2, '0');
export const dayKeyOf = (d: Date): DayKey => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export function parseDayKey(k: DayKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** [from, to) unix seconds for a day range (local time, inclusive of the last day). */
export function rangeToUnix(r: DayRange): { from: number; to: number } {
  const end = parseDayKey(r.to);
  end.setDate(end.getDate() + 1);
  return { from: parseDayKey(r.from).getTime() / 1000, to: end.getTime() / 1000 };
}

const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export function formatRange(r: DayRange): string {
  const f = (k: DayKey) => { const d = parseDayKey(k); return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  return r.from === r.to ? f(r.from) : `${f(r.from)} — ${f(r.to)}`;
}

/** What the stats cover: a calendar month (with the plan), a day, a week (Monday–Sunday), a year or any range. */
export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'custom';

/** The day / week / year containing `anchor`. */
export function periodRange(kind: 'day' | 'week' | 'year', anchor: Date): DayRange {
  if (kind === 'day') return { from: dayKeyOf(anchor), to: dayKeyOf(anchor) };
  if (kind === 'year') return { from: `${anchor.getFullYear()}-01-01`, to: `${anchor.getFullYear()}-12-31` };
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - ((anchor.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { from: dayKeyOf(monday), to: dayKeyOf(sunday) };
}

/** The previous / next day, week or year. */
export function shiftAnchor(kind: 'day' | 'week' | 'year', anchor: Date, delta: number): Date {
  if (kind === 'year') return new Date(anchor.getFullYear() + delta, anchor.getMonth(), 1);
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + delta * (kind === 'week' ? 7 : 1));
}

/** "4 окт 2026", "28 сен 2026 — 4 окт 2026", "2026". */
export function periodLabel(kind: PeriodKind, range: DayRange): string {
  return kind === 'year' ? range.from.slice(0, 4) : formatRange(range);
}

/** How many days of the range fall into each month: { '2026-09': 2, '2026-10': 5 }. */
export function daysByMonth(r: DayRange): Map<string, number> {
  const out = new Map<string, number>();
  for (let d = parseDayKey(r.from); dayKeyOf(d) <= r.to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const ym = dayKeyOf(d).slice(0, 7);
    out.set(ym, (out.get(ym) ?? 0) + 1);
  }
  return out;
}

/** Number of days in the range (inclusive). */
export function rangeDays(r: DayRange): number {
  return [...daysByMonth(r).values()].reduce((a, b) => a + b, 0);
}

/** Days in the month 'YYYY-MM'. */
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** The rhythm of a flexible plan item's norm (mirrors NormPeriod in db/plans). */
export type NormRhythm = 'day' | 'week' | '2weeks' | 'month';

/**
 * The window a category's norm is checked over when looking at `viewed`: the viewed period itself if it is at
 * least as long as the rhythm; otherwise the calendar week / the two weeks ending with that week / the month so
 * far that contain the viewed period's last day.
 */
export function normWindow(rhythm: NormRhythm, viewed: DayRange): DayRange {
  const days = rangeDays(viewed);
  const end = parseDayKey(viewed.to);
  if (rhythm === 'day' || (rhythm === 'week' && days >= 7) || (rhythm === '2weeks' && days >= 14)) return viewed;
  if (rhythm === 'month') return { from: `${viewed.to.slice(0, 7)}-01`, to: viewed.to };
  const week = periodRange('week', end);
  if (rhythm === 'week') return week;
  const start = parseDayKey(week.from);
  return { from: dayKeyOf(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)), to: week.to };
}

const SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
/** "28 сен – 4 окт", "4 окт" (no year: windows are always near). */
export function shortRange(r: DayRange): string {
  const f = (k: DayKey) => { const d = parseDayKey(k); return `${d.getDate()} ${SHORT[d.getMonth()]}`; };
  return r.from === r.to ? f(r.from) : `${f(r.from)} – ${f(r.to)}`;
}
