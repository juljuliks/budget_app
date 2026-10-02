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
