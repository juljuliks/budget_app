// What a month's plan items carry over to a later one, and the repeating ones followed by the months planned already.
import { getDb } from '../index';
import type { Db } from '../types';
import { currentYm } from './months';
import { countRegularItems } from './regular';

/**
 * `from`'s items into `to` (those already there are left): pinned ones and the categories with regular payments with
 * their amount, the others empty; a regular payment within the month — only repeated, till its end. One category only:
 * `categoryId`.
 */
export async function carryItems(db: Db, from: string, to: string, categoryId?: number): Promise<void> {
  // "Дата окончания" before this month: not repeated any more
  const ended = `p.until IS NOT NULL AND p.until < '${to}-01'`;
  await db.run(
    `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, pinned, kind, currency, norm_period, until, every, weekdays, unit_minor)
      -- a category with regular payments always goes on with its amount (a dated one is counted again right after)
      SELECT ?, p.category_id, CASE WHEN (p.pinned = 1 AND NOT (${ended})) OR c.recurring = 1 THEN p.limit_minor ELSE 0 END,
        CASE WHEN ${ended} THEN 0 ELSE p.pinned END, p.kind, p.currency, p.norm_period,
        CASE WHEN ${ended} THEN NULL ELSE p.until END, p.every, p.weekdays, p.unit_minor
      FROM plan_items p JOIN categories c ON c.id = p.category_id
      WHERE p.ym = ? AND c.deleted_at IS NULL AND p.category_id IS coalesce(?, p.category_id)
        AND (p.kind != 'fund' OR EXISTS (SELECT 1 FROM funds f WHERE f.category_id = p.category_id AND f.closed_ym IS NULL))
        -- a regular payment within the month goes on only repeated each month, till its end
        AND NOT (p.kind = 'fixed' AND p.every IS NOT NULL AND (p.pinned = 0 OR ${ended}))`,
    [to, from, categoryId ?? null]);
  await countRegularItems(to, db);
}

/** A category's item as the months after it see it: whether it repeats, whether it is a one-off payment. */
export type ItemShape = { repeats: boolean; oneOff: boolean; fund: boolean } | null;

/** The item's shape in `ym` (null — none). */
export async function itemShape(ym: string, categoryId: number, db?: Db): Promise<ItemShape> {
  db ??= await getDb();
  const r = await db.get<{ pinned: number; kind: string; every: string | null; recurring: number }>(
    `SELECT p.pinned, p.kind, p.every, c.recurring FROM plan_items p JOIN categories c ON c.id = p.category_id
      WHERE p.ym = ? AND p.category_id = ?`, [ym, categoryId]);
  if (!r) return null;
  const oneOff = r.kind === 'fixed' && r.every === null && r.recurring !== 1;
  return { repeats: !oneOff && (r.pinned === 1 || r.recurring === 1), oneOff, fund: r.kind === 'fund' };
}

/**
 * The plan of a month not over yet is what the months after it start from: a repeating item changed in it (its amount,
 * kind, «Как тратите», repeating) is the same in each later month planned already, changed by hand or not; it stopped
 * repeating — carried as to a new month; became a one-off payment or removed — gone from them. Other items there stay
 * as they are; a past month's change doesn't move them. `before` — its shape before the change.
 */
export async function followItem(ym: string, categoryId: number, before: ItemShape, db?: Db): Promise<void> {
  if (ym < currentYm()) return;
  db ??= await getDb();
  const after = await itemShape(ym, categoryId, db);
  // a fund's months are its own (setFund, refreshFundItems)
  if (before?.fund || after?.fund || !(before?.repeats || after?.repeats)) return;
  const later = await db.all<{ ym: string }>('SELECT ym FROM plan_months WHERE ym > ? ORDER BY ym', [ym]);
  for (const m of later) {
    await db.run('DELETE FROM plan_items WHERE ym = ? AND category_id = ?', [m.ym, categoryId]);
    if (after && !after.oneOff) await carryItems(db, ym, m.ym, categoryId);
  }
}
