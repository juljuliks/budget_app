// A repeating payment's charges in time: the day it was set to plus whole periods, back and forth. A charge is done when an
// operation of its merchant came within WINDOW_DAYS of its day (the bank charges a day or two off, the SMS comes late).
// Nothing is stored about done charges: the next one is counted from the operations each time (deleting one brings its
// charge back). Days are 'YYYY-MM-DD'; a day past the month's end is its last day (31 → 30 Nov, 28 Feb), each charge
// counted from the set day, so a short month doesn't move the ones after it.

/** How far from its day an operation still is the charge (± days). */
export const WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;

type Ymd = { y: number; m: number; d: number };

const parse = (day: string): Ymd => {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m: m - 1, d };
};
const p2 = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const toUtc = (day: string) => { const { y, m, d } = parse(day); return Date.UTC(y, m, d); };

/** `day` moved by `months` (negative — back); a day past the month's end is its last day. */
export function addMonths(day: string, months: number): string {
  const { y, m, d } = parse(day);
  const first = new Date(y, m + months, 1);
  const yy = first.getFullYear();
  const mm = first.getMonth();
  return `${yy}-${p2(mm + 1)}-${p2(Math.min(d, lastDay(yy, mm)))}`;
}

/** Whole days from `a` to `b` (negative when `b` is before). */
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** The charge `k` periods from the set day (k < 0 — before it). */
export const chargeAt = (due: string, periodMonths: number, k: number) => addMonths(due, k * periodMonths);

/** Was the charge on `day` done: an operation's day (of `opDays`) within the window. */
export const isDone = (day: string, opDays: string[]) => opDays.some((o) => Math.abs(daysBetween(day, o)) <= WINDOW_DAYS);

/** The k of the first charge on or after `day`. */
function firstOnOrAfter(due: string, periodMonths: number, day: string): number {
  const a = parse(due);
  const b = parse(day);
  let k = Math.floor(((b.y - a.y) * 12 + (b.m - a.m)) / periodMonths) - 1;
  // the estimate's month is a period before `day`'s: step on to it
  while (chargeAt(due, periodMonths, k) < day) k++;
  return k;
}

/** The charges with a day in [from, to] (inclusive), in order. */
export function chargesBetween(due: string, periodMonths: number, from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = firstOnOrAfter(due, periodMonths, from); ; k++) {
    const day = chargeAt(due, periodMonths, k);
    if (day > to) return out;
    out.push(day);
  }
}

/**
 * The next charge: the first from the set day on that isn't done and whose window hasn't passed by `today` (a charge
 * missed more than the window ago isn't waited for any more).
 */
export function nextCharge(due: string, periodMonths: number, opDays: string[], today: string): string {
  for (let k = 0; ; k++) {
    const day = chargeAt(due, periodMonths, k);
    if (daysBetween(day, today) <= WINDOW_DAYS && !isDone(day, opDays)) return day;
  }
}

/** First and last day of the month `ym` ('YYYY-MM'). */
export function monthDays(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  return [`${ym}-01`, `${ym}-${p2(lastDay(y, m - 1))}`];
}

/**
 * The month's charges: those from the set day on, and the done ones before it (the operation the repeating payment was made
 * from); none before `sinceDay` (the first day of the month it was made in).
 */
export function monthCharges(due: string, periodMonths: number, ym: string, opDays: string[], sinceDay: string): Array<{ day: string; done: boolean }> {
  const [from, to] = monthDays(ym);
  return chargesBetween(due, periodMonths, from, to)
    .map((day) => ({ day, done: isDone(day, opDays) }))
    .filter((c) => (c.day >= due || c.done) && c.day >= sinceDay);
}

/**
 * The day offered for a repeating payment made from its merchant's last operation: that day plus the period, moved on by
 * periods until it isn't past `today`.
 */
export function offeredDue(lastOpDay: string, periodMonths: number, today: string): string {
  let k = 1;
  while (chargeAt(lastOpDay, periodMonths, k) < today) k++;
  return chargeAt(lastOpDay, periodMonths, k);
}

/**
 * The charge `ym`'s saving is for: the first on or after the month's 1st (from the set day on, or a done one), not
 * paid before the month (a charge a few days early belongs to the month it was paid in) or before `after` (the day the
 * saving was made: one paid already isn't its).
 */
export function savingFor(due: string, periodMonths: number, ym: string, opDays: string[], after = ''): string {
  const month = `${ym}-01`;
  const from = after > month ? after : month;
  for (let to = addMonths(from, periodMonths); ; to = addMonths(to, periodMonths)) {
    const day = chargesBetween(due, periodMonths, month, to).find((d) =>
      (d >= due || isDone(d, opDays)) && !opDays.some((o) => o < from && Math.abs(daysBetween(d, o)) <= WINDOW_DAYS));
    if (day) return day;
  }
}
