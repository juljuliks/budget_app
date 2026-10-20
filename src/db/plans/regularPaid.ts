// A regular payment within the month paid by its category's spending: how many of its days (regularTimes) — every day
// (that day's spending), every week (within a few days of one).
import { getDb } from '../index';
import type { Db } from '../types';
import { Currency } from '../fx';
import { categorySpends } from '../recurring/reads';
import { asCurrency, currentYm } from './months';
import { dayOfUnix } from '../recurring/reads';
import { planConverter } from './budget';
import { Every, paidTimes, regularDays, timesInMonth } from './regularTimes';

type Row = { category_id: number; currency: string; every: Every | null; weekdays: number | null; unit_minor: number | null; until: string | null };

/** The regular items of `ym`: their days paid, by category (the spending in the item's currency; none without a rate). */
export async function regularPaid(ym: string, rows: Row[], db: Db): Promise<Map<number, number>> {
  const weekly = rows.filter((r) => r.every);
  if (!weekly.length) return new Map();
  const spends = await categorySpends(weekly.map((r) => r.category_id), db);
  const conv = await planConverter(ym);
  return new Map(weekly.map((r) => {
    const own = (spends.get(r.category_id) ?? []).map((s) => ({ ...s, minor: conv(s.minor, asCurrency(s.currency), asCurrency(r.currency)) ?? 0 }));
    const bits = r.every === 'day' ? 127 : r.weekdays ?? 0;
    return [r.category_id, paidTimes(regularDays(ym, r.every!, bits, r.until), bits, own, r.unit_minor ?? 0)];
  }));
}

/**
 * The current month's regular items: what each is expected to take by its end — its days paid plus the days from today
 * on, by the amount, at most its plan (one gone unpaid is skipped); another month — none.
 */
export async function regularExpected(ym: string, rows: Row[], db: Db, now = new Date()): Promise<Map<number, number>> {
  if (ym !== currentYm(now)) return new Map();
  const paid = await regularPaid(ym, rows, db);
  const today = dayOfUnix(Math.floor(now.getTime() / 1000));
  return new Map(rows.filter((r) => r.every).map((r) => {
    const days = regularDays(ym, r.every!, r.every === 'day' ? 127 : r.weekdays ?? 0, r.until);
    const times = Math.min(days.length, (paid.get(r.category_id) ?? 0) + days.filter((d) => d >= today).length);
    return [r.category_id, times * (r.unit_minor ?? 0)];
  }));
}

/** The category's regular payment within `ym`: how often, each time's amount, the times and those paid. */
export type RegularOfMonth = { every: Every; weekdays: number; unit_minor: number; currency: Currency; times: number; paid: number };

export async function regularOfCategory(categoryId: number, ym: string): Promise<RegularOfMonth | null> {
  const db = await getDb();
  const r = await db.get<Row>(
    "SELECT category_id, currency, every, weekdays, unit_minor, until FROM plan_items WHERE ym = ? AND category_id = ? AND kind = 'fixed' AND every IS NOT NULL",
    [ym, categoryId]);
  if (!r?.every) return null;
  const paid = (await regularPaid(ym, [r], db)).get(categoryId) ?? 0;
  return {
    every: r.every, weekdays: r.weekdays ?? 0, unit_minor: r.unit_minor ?? 0, currency: asCurrency(r.currency),
    times: timesInMonth(ym, r.every, r.weekdays ?? 0, r.until), paid,
  };
}
