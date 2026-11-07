// A regular payment within the month ("Каждый день" / "Каждую неделю"): its category's schedule (category_schedules —
// the weekdays, an amount each time, its end); each month's item ('fixed' with `every`) counted from it — the times it
// comes in the month up to its end ("Дата окончания"). A new month gets it from the schedule.
// A monthly one has no day: its amount by hand in each month's plan (setUndatedAhead).
import { getDb } from '../index';
import type { Db, SqlParam } from '../types';
import type { Currency } from '../fx';
import { asCurrency } from './months';
import { setPlanAmount } from './items';
import { timesInMonth } from './regularTimes';
import { followItem, itemShape } from './carry';
import { kindFromItem } from './categoryKind';
import type { Every } from './regularTimes';

export type RegularItem = { every: Every; weekdays: number; unit_minor: number; until: string | null };
export type CategorySchedule = RegularItem & { category_id: number; currency: Currency };

export async function categorySchedule(categoryId: number, db?: Db): Promise<CategorySchedule | null> {
  db ??= await getDb();
  const r = await db.get<{ category_id: number; every: Every; weekdays: number | null; unit_minor: number; currency: string; until: string | null }>(
    'SELECT category_id, every, weekdays, unit_minor, currency, until FROM category_schedules WHERE category_id = ?', [categoryId]);
  return r ? { ...r, weekdays: r.weekdays ?? 0, currency: asCurrency(r.currency) } : null;
}

/**
 * The category's regular payment within the month set (its schedule), its item in `ym` counted from it, and in the
 * coming months planned already; throws OverBudgetError past the budget, as setPlanAmount (`takeLocked` too).
 */
export async function setRegularItem(ym: string, categoryId: number, r: RegularItem, currency: Currency, takeLocked: boolean | 'all' = false): Promise<void> {
  const db = await getDb();
  const before = await itemShape(ym, categoryId, db);
  await setPlanAmount(ym, categoryId, r.unit_minor * timesInMonth(ym, r.every, r.weekdays, r.until), 'fixed', currency, undefined, takeLocked);
  await db.run(
    `INSERT INTO category_schedules (category_id, every, weekdays, unit_minor, currency, until) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(category_id) DO UPDATE SET every = excluded.every, weekdays = excluded.weekdays, unit_minor = excluded.unit_minor,
        currency = excluded.currency, until = excluded.until`,
    [categoryId, r.every, r.every === 'week' ? r.weekdays : null, r.unit_minor, currency, r.until]);
  await db.run(
    'UPDATE plan_items SET every = ?, weekdays = ?, unit_minor = ?, until = ?, pinned = 1 WHERE ym = ? AND category_id = ?',
    [r.every, r.every === 'week' ? r.weekdays : null, r.unit_minor, r.until, ym, categoryId]);
  await kindFromItem(ym, categoryId, db);
  await followItem(ym, categoryId, before, db);
}

/**
 * A new month (`ym`) gets each regular payment within the month from its category's schedule — as it is now, till its
 * end; then every such item counted: its amount the times in the month. One category only: `categoryId`.
 */
export async function countRegularItems(ym: string, db: Db, categoryId?: number): Promise<void> {
  await db.run(
    `INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency, every, weekdays, unit_minor, until, pinned)
      SELECT ?, s.category_id, 0, 'fixed', s.currency, s.every, s.weekdays, s.unit_minor, s.until, 1
      FROM category_schedules s JOIN categories c ON c.id = s.category_id
      WHERE c.deleted_at IS NULL AND c.plan_kind = 'regular' AND (s.until IS NULL OR s.until >= ?)
        AND s.category_id IS coalesce(?, s.category_id)
      ON CONFLICT(ym, category_id) DO UPDATE SET kind = 'fixed', currency = excluded.currency, every = excluded.every,
        weekdays = excluded.weekdays, unit_minor = excluded.unit_minor, until = excluded.until, pinned = 1`,
    [ym, `${ym}-01`, categoryId ?? null]);
  const rows = await db.all<{ category_id: number; every: Every; weekdays: number | null; unit_minor: number; until: string | null }>(
    "SELECT category_id, every, weekdays, unit_minor, until FROM plan_items WHERE ym = ? AND kind = 'fixed' AND every IS NOT NULL", [ym]);
  for (const r of rows) {
    await db.run('UPDATE plan_items SET limit_minor = ? WHERE ym = ? AND category_id = ?',
      [r.unit_minor * timesInMonth(ym, r.every, r.weekdays ?? 0, r.until), ym, r.category_id]);
  }
}

/** What turning a schedule off took: "Отменить" puts it and the items back. */
export type StoppedSchedule = { schedule: CategorySchedule | null; items: Array<Record<string, SqlParam>> };

/**
 * The category's regular payment within the month off (removed from the plan): its schedule gone, its items from `ym`
 * on removed, the category without a kind (added again — a one-off payment).
 */
export async function stopSchedule(ym: string, categoryId: number): Promise<StoppedSchedule> {
  const db = await getDb();
  return db.transaction(async (t) => {
    const schedule = await categorySchedule(categoryId, t);
    const items = await t.all<Record<string, SqlParam>>('SELECT * FROM plan_items WHERE category_id = ? AND ym >= ?', [categoryId, ym]);
    await t.run('DELETE FROM plan_items WHERE category_id = ? AND ym >= ?', [categoryId, ym]);
    await t.run('DELETE FROM category_schedules WHERE category_id = ?', [categoryId]);
    await t.run("UPDATE categories SET plan_kind = NULL WHERE id = ? AND plan_kind = 'regular'", [categoryId]);
    return { schedule, items };
  });
}

/** "Отменить" after stopSchedule: the schedule, the kind and the items back as they were. */
export async function restoreSchedule(s: StoppedSchedule): Promise<void> {
  const db = await getDb();
  await db.transaction(async (t) => {
    if (s.schedule) {
      const r = s.schedule;
      await t.run('INSERT OR REPLACE INTO category_schedules (category_id, every, weekdays, unit_minor, currency, until) VALUES (?, ?, ?, ?, ?, ?)',
        [r.category_id, r.every, r.every === 'week' ? r.weekdays : null, r.unit_minor, r.currency, r.until]);
      await t.run("UPDATE categories SET plan_kind = 'regular' WHERE id = ?", [r.category_id]);
    }
    for (const row of s.items) {
      const cols = Object.keys(row);
      await t.run(`INSERT OR IGNORE INTO plan_items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c]));
    }
  });
}

/**
 * A monthly regular payment saved without a day: the months after `ym` whose item was counted from its charges ('subs')
 * get its amount by hand, as `ym`'s.
 */
export async function setUndatedAhead(ym: string, categoryId: number, amountMinor: number, currency: string): Promise<void> {
  await (await getDb()).run("UPDATE plan_items SET kind = 'fixed', limit_minor = ?, currency = ? WHERE category_id = ? AND ym > ? AND kind = 'subs'",
    [amountMinor, currency, categoryId, ym]);
}
