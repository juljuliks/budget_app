// A category's kind in the plan ("В плане" on its page): what its item is and what a new month gets of it.
import { getDb } from '../index';
import type { Db } from '../types';
import { currentYm } from './months';
import { followItem, itemShape } from './carry';

/**
 * 'limit' — its amount and «Как тратите» go on to the next month; 'regular' — counted by its payments; 'oneoff' — not
 * carried, added to a month when needed; 'fund' — a fund's contribution. null — not set yet (added to a plan: 'oneoff').
 */
export type CategoryPlanKind = 'limit' | 'regular' | 'oneoff' | 'fund';

export async function categoryPlanKind(categoryId: number, db?: Db): Promise<CategoryPlanKind | null> {
  db ??= await getDb();
  return (await db.get<{ k: CategoryPlanKind | null }>('SELECT plan_kind AS k FROM categories WHERE id = ?', [categoryId]))?.k ?? null;
}

/**
 * The category's kind follows its item in `ym` written just now (a month not over yet): a limit, a payment within
 * the month or with repeating payments ('regular'), another payment ('oneoff'), a fund's. «📺 Подписки» has none.
 */
export async function kindFromItem(ym: string, categoryId: number, db: Db): Promise<void> {
  if (ym < currentYm()) return;
  await db.run(
    `UPDATE categories SET plan_kind = (
        SELECT CASE WHEN p.kind = 'limit' THEN 'limit' WHEN p.kind = 'fund' THEN 'fund'
          WHEN p.kind = 'subs' OR p.every IS NOT NULL OR categories.recurring = 1 THEN 'regular' ELSE 'oneoff' END
        FROM plan_items p WHERE p.ym = ? AND p.category_id = categories.id)
      WHERE id = ? AND system IS NULL AND EXISTS (SELECT 1 FROM plan_items WHERE ym = ? AND category_id = ?)`,
    [ym, categoryId, ym, categoryId]);
}

/**
 * Sets the category's kind. Its item in this month and in the coming months planned already becomes a limit or a
 * one-off payment as asked (a one-off is then gone from the later months, as a one-off item is: followItem); the past
 * months keep theirs. A regular payment or a fund asks no questions of its own "Импульсивные покупки": they are off.
 * The payments and the fund themselves are their own writes (recurring-payments, fund).
 */
export async function setCategoryPlanKind(categoryId: number, kind: CategoryPlanKind | null, nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  await db.transaction(async (t) => {
    const months = await t.all<{ ym: string }>(
      "SELECT ym FROM plan_items WHERE category_id = ? AND ym >= ? AND kind IN ('limit', 'fixed') ORDER BY ym", [categoryId, nowYm]);
    const first = months[0]?.ym;
    // what the later months saw before the change
    const before = first ? await itemShape(first, categoryId, t) : null;
    await t.run('UPDATE categories SET plan_kind = ? WHERE id = ? AND system IS NULL', [kind, categoryId]);
    if (kind === 'regular' || kind === 'fund') await t.run('UPDATE categories SET impulse = 0 WHERE id = ?', [categoryId]);
    // no longer a regular payment within the month: its schedule gone (the items become the kind asked below)
    if (kind !== 'regular') await t.run('DELETE FROM category_schedules WHERE category_id = ?', [categoryId]);
    if ((kind !== 'limit' && kind !== 'oneoff') || !first) return;
    const item = kind === 'limit' ? "kind = 'limit'" : "kind = 'fixed'";
    await t.run(`UPDATE plan_items SET ${item}, every = NULL, weekdays = NULL, unit_minor = NULL WHERE category_id = ? AND ym >= ? AND kind IN ('limit', 'fixed')`,
      [categoryId, nowYm]);
    await followItem(first, categoryId, before, t);
  });
}
