// A repeating payment's charges in time: the day it was set to plus whole periods, back and forth (a one-off one: that day
// only). A charge is done when an operation of its merchant came within the window of its day (the bank charges a day or
// two off, the SMS comes late).
// Nothing is stored about done charges: the next one is counted from the operations each time (deleting one brings its
// charge back). Days are 'YYYY-MM-DD'; a day past the month's end is its last day (31 → 30 Nov, 28 Feb), each charge
// counted from the set day, so a short month doesn't move the ones after it.

/** How far from its day an operation still is the charge (± days); a weekly one's is less (windowOf). */
export const WINDOW_DAYS = 7;

/** How often: > 0 — every N months, < 0 — every N weeks (−1: every week), 0 — once (on its day only). */
export type Period = number;
export const ONCE: Period = 0;
export const WEEKLY: Period = -1;

/** The window of a period: under half of it (a charge every week: ± 3 days), at most WINDOW_DAYS. */
export const windowOf = (p: Period) => (p < 0 ? Math.min(WINDOW_DAYS, Math.floor((-p * 7 - 1) / 2)) : WINDOW_DAYS);

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

/** `day` moved by `days` (negative — back). */
export function addDays(day: string, days: number): string {
  const d = new Date(toUtc(day) + days * DAY_MS);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** The charge `k` periods from the set day (k < 0 — before it). Not for a one-off one: its only charge is its day. */
export const chargeAt = (due: string, p: Period, k: number) => (p < 0 ? addDays(due, k * -p * 7) : addMonths(due, k * p));

/** Was the charge on `day` done: an operation's day (of `opDays`) within the window. */
export const isDone = (day: string, opDays: string[], p: Period = 1) => opDays.some((o) => Math.abs(daysBetween(day, o)) <= windowOf(p));

/**
 * The operation day that paid the charge on `day` (the closest within the window; the earlier one on a tie); null — none
 * (a category's own payment counts its own day, once it has passed, as that operation).
 */
export function paidOn(day: string, opDays: string[], p: Period): string | null {
  const w = windowOf(p);
  return opDays.reduce<string | null>((best, o) => {
    const dist = Math.abs(daysBetween(day, o));
    if (dist > w) return best;
    if (best === null) return o;
    const bestDist = Math.abs(daysBetween(day, best));
    return dist < bestDist || (dist === bestDist && o < best) ? o : best;
  }, null);
}

/** The k of the first charge on or after `day`. */
function firstOnOrAfter(due: string, p: Period, day: string): number {
  const a = parse(due);
  const b = parse(day);
  let k = p < 0 ? Math.floor(daysBetween(due, day) / (-p * 7)) - 1 : Math.floor(((b.y - a.y) * 12 + (b.m - a.m)) / p) - 1;
  // the estimate is a period before `day`: step on to it
  while (chargeAt(due, p, k) < day) k++;
  return k;
}

/** The charges with a day in [from, to] (inclusive), in order. */
export function chargesBetween(due: string, p: Period, from: string, to: string): string[] {
  if (p === ONCE) return due >= from && due <= to ? [due] : [];
  const out: string[] = [];
  for (let k = firstOnOrAfter(due, p, from); ; k++) {
    const day = chargeAt(due, p, k);
    if (day > to) return out;
    out.push(day);
  }
}

/**
 * The next charge: the first from the set day on that isn't done and whose window hasn't passed by `today` (a charge
 * missed more than the window ago isn't waited for any more); null — a one-off one done or missed, or past its end
 * (`until`, "Дата окончания"): nothing to wait for.
 */
export function nextCharge(due: string, p: Period, opDays: string[], today: string, until?: string | null): string | null {
  const waited = (day: string) => daysBetween(day, today) <= windowOf(p) && !isDone(day, opDays, p);
  if (p === ONCE) return waited(due) ? due : null;
  for (let k = 0; ; k++) {
    const day = chargeAt(due, p, k);
    if (until && day > until) return null;
    if (waited(day)) return day;
  }
}

/** First and last day of the month `ym` ('YYYY-MM'). */
export function monthDays(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  return [`${ym}-01`, `${ym}-${p2(lastDay(y, m - 1))}`];
}

/**
 * The month's charges: those from the set day on, and the done ones before it (the operation the repeating payment was made
 * from); none before `sinceDay` (the first day of the month it was made in) or after `until` ("Дата окончания").
 */
export function monthCharges(due: string, p: Period, ym: string, opDays: string[], sinceDay: string, until?: string | null): Array<{ day: string; done: boolean }> {
  const [from, to] = monthDays(ym);
  return chargesBetween(due, p, from, until && until < to ? until : to)
    .map((day) => ({ day, done: isDone(day, opDays, p) }))
    .filter((c) => (c.day >= due || c.done) && c.day >= sinceDay);
}

/**
 * The day offered for a repeating payment made from its merchant's last operation: that day plus the period, moved on by
 * periods until it isn't past `today`; a one-off one — that operation itself.
 */
export function offeredDue(lastOpDay: string, p: Period, today: string): string {
  if (p === ONCE) return lastOpDay;
  let k = 1;
  while (chargeAt(lastOpDay, p, k) < today) k++;
  return chargeAt(lastOpDay, p, k);
}

/** The charge before `due` — what another period is counted from; a one-off one's is itself. */
export const chargeBefore = (due: string, p: Period) => (p === ONCE ? due : chargeAt(due, p, -1));

/**
 * The charge `ym`'s saving is for: the first on or after the month's 1st (from the set day on, or a done one), not
 * paid before the month (a charge a few days early belongs to the month it was paid in) or before `after` (the day the
 * saving was made: one paid already isn't its); null — a one-off one already past.
 */
export function savingFor(due: string, p: Period, ym: string, opDays: string[], after = '', until?: string | null): string | null {
  const month = `${ym}-01`;
  if (until && until < month) return null;
  const from = after > month ? after : month;
  const its = (d: string) => (d >= due || isDone(d, opDays, p)) && !opDays.some((o) => o < from && Math.abs(daysBetween(d, o)) <= windowOf(p));
  if (p === ONCE) return due >= month && its(due) ? due : null;
  for (let to = chargeAt(from, p, 1); ; to = chargeAt(to, p, 1)) {
    const day = chargesBetween(due, p, month, to).find(its);
    // past its end: nothing more to save for
    if (day) return until && day > until ? null : day;
    if (until && to > until) return null;
  }
}
