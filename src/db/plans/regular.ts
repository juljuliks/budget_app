// A regular payment within the month (the plan's "Каждый день" / "Каждую неделю"): an amount each time, the month's item
// the times it comes in the month — every day, or on the weekdays picked — up to its end ("Дата окончания"). Stored as a
// one-off payment's item ('fixed') with `every`; "Повторять каждый месяц" off — it ends with the month.
import { getDb } from '../index';
import type { Db } from '../types';
import type { Currency } from '../fx';
import { setPlanAmount } from './items';
import { timesInMonth } from './regularTimes';
import type { Every } from './regularTimes';

export type RegularItem = { every: Every; weekdays: number; unit_minor: number; until: string | null; pinned: boolean };

/** The category's item in `ym` a regular payment within the month; throws OverBudgetError past the budget, as setPlanAmount. */
export async function setRegularItem(ym: string, categoryId: number, r: RegularItem, currency: Currency, takeLocked = false): Promise<void> {
  await setPlanAmount(ym, categoryId, r.unit_minor * timesInMonth(ym, r.every, r.weekdays, r.until), 'fixed', currency, undefined, takeLocked);
  await (await getDb()).run(
    'UPDATE plan_items SET every = ?, weekdays = ?, unit_minor = ?, until = ?, pinned = ? WHERE ym = ? AND category_id = ?',
    [r.every, r.every === 'week' ? r.weekdays : null, r.unit_minor, r.until, r.pinned ? 1 : 0, ym, categoryId]);
}

/** A new month's regular items (carried over): their amount the times in it. */
export async function countRegularItems(ym: string, db: Db): Promise<void> {
  const rows = await db.all<{ category_id: number; every: Every; weekdays: number | null; unit_minor: number; until: string | null }>(
    "SELECT category_id, every, weekdays, unit_minor, until FROM plan_items WHERE ym = ? AND kind = 'fixed' AND every IS NOT NULL", [ym]);
  for (const r of rows) {
    await db.run('UPDATE plan_items SET limit_minor = ? WHERE ym = ? AND category_id = ?',
      [r.unit_minor * timesInMonth(ym, r.every, r.weekdays ?? 0, r.until), ym, r.category_id]);
  }
}
