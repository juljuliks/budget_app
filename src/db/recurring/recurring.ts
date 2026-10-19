// "Повторяющиеся платежи" of a category turned on and off. Off: what its payments saved goes to this month's savings,
// its plan items from this month on keep their amount as an obligatory payment (by hand from now on), the payments stay
// (on again — they count again). "Отменить" puts it back as it was.
import { getDb } from '../index';
import type { SqlParam } from '../types';
import { setRecurring } from '../categories';
import { currentYm } from '../plans/months';
import { refreshRecurringItems } from '../plans/recurringItems';
import { savedNow, SavingUndo, stopSaving, undoSaving } from './savingWrites';

export type RecurringUndo = { category_id: number; items: string[]; savings: SavingUndo[] };

/** Its payments' ids (not deleted). */
async function paymentsOf(categoryId: number): Promise<number[]> {
  const db = await getDb();
  return (await db.all<{ id: number }>('SELECT id FROM recurring_payments WHERE category_id = ? AND deleted_at IS NULL', [categoryId])).map((r) => r.id);
}

/** What turning it off gives back to this month's savings: each payment saved up for, with what it has. */
export async function savedInCategory(categoryId: number): Promise<Array<{ name: string; minor: number; currency: string }>> {
  const db = await getDb();
  const out: Array<{ name: string; minor: number; currency: string }> = [];
  for (const id of await paymentsOf(categoryId)) {
    const minor = await savedNow(id);
    const s = await db.get<{ name: string; currency: string }>('SELECT name, currency FROM recurring_payments WHERE id = ?', [id]);
    if (minor > 0 && s) out.push({ name: s.name, minor, currency: s.currency });
  }
  return out;
}

/** Turns it on (its plan counted from the payments again) or off; off — how to put it back. */
export async function turnRecurring(categoryId: number, on: boolean, nowYm = currentYm()): Promise<RecurringUndo | null> {
  const db = await getDb();
  if (on) {
    await setRecurring(categoryId, true, db);
    await refreshRecurringItems(nowYm);
    return null;
  }
  const savings: SavingUndo[] = [];
  for (const id of await paymentsOf(categoryId)) {
    const stopped = await stopSaving(id, nowYm);
    if (stopped) savings.push(stopped.undo);
  }
  const items = (await db.all<{ ym: string }>("SELECT ym FROM plan_items WHERE category_id = ? AND ym >= ? AND kind = 'subs'", [categoryId, nowYm])).map((r) => r.ym);
  await db.run("UPDATE plan_items SET kind = 'fixed' WHERE category_id = ? AND ym >= ? AND kind = 'subs'", [categoryId, nowYm]);
  await setRecurring(categoryId, false, db);
  return { category_id: categoryId, items, savings };
}

/** "Отменить" after turning it off. */
export async function undoRecurring(u: RecurringUndo, nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  await setRecurring(u.category_id, true, db);
  for (const ym of u.items) await db.run("UPDATE plan_items SET kind = 'subs' WHERE category_id = ? AND ym = ?", [u.category_id, ym]);
  for (const s of u.savings) await undoSaving(s, nowYm);
  await refreshRecurringItems(nowYm);
}

/** A category with repeating payments taken out of the plan from `ym` on: its items there as they were, and it turned off. */
export type RemovedRecurring = { rows: Array<Record<string, SqlParam>>; off: RecurringUndo | null };

/**
 * "Убрать из плана" of a category with repeating payments: they are off (as turnRecurring — what they saved goes to this
 * month's savings), and its items from `ym` on are gone (not only `ym`'s: on, they'd count it again next month).
 */
export async function removeRecurringFrom(ym: string, categoryId: number, nowYm = currentYm()): Promise<RemovedRecurring> {
  const db = await getDb();
  const rows = await db.all<Record<string, SqlParam>>('SELECT * FROM plan_items WHERE category_id = ? AND ym >= ?', [categoryId, ym]);
  const off = await turnRecurring(categoryId, false, nowYm);
  await db.run('DELETE FROM plan_items WHERE category_id = ? AND ym >= ?', [categoryId, ym]);
  return { rows, off };
}

/** "Отменить" after removeRecurringFrom: its items back as they were, its repeating payments on. */
export async function restoreRecurring(r: RemovedRecurring, nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  for (const row of r.rows) {
    const cols = Object.keys(row);
    await db.run(`INSERT OR IGNORE INTO plan_items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c]));
  }
  if (r.off) await undoRecurring(r.off, nowYm);
}
