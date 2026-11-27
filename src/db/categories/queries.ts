import { getDb } from '../index';
import type { Db } from '../types';
import { categorySpendingSql, signedSpendSql } from '../spending';
import { type Category, categoryLabel } from './labels';

/** The id of "Пополнение счёта". */
export async function topUpCategoryId(db?: Db): Promise<number | null> {
  db ??= await getDb();
  return (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'topup'"))?.id ?? null;
}

/** "📺 Подписки" (the system one): a subscription without a category goes there. */
export async function subscriptionsCategoryId(db?: Db): Promise<number | null> {
  db ??= await getDb();
  return (
    (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'subs' AND deleted_at IS NULL"))?.id ?? null
  );
}

/** "Регулярные платежи" on or off: the category's kind in the plan a regular payment, or none any more. */
export async function setRecurring(id: number, on: boolean, db?: Db): Promise<void> {
  db ??= await getDb();
  await db.run('UPDATE categories SET recurring = ? WHERE id = ?', [on ? 1 : 0, id]);
  if (on) await db.run("UPDATE categories SET plan_kind = 'regular' WHERE id = ? AND system IS NULL", [id]);
  // its payments count its item now: a schedule within the month it had is gone
  if (on) await db.run('DELETE FROM category_schedules WHERE category_id = ?', [id]);
  else await db.run("UPDATE categories SET plan_kind = NULL WHERE id = ? AND plan_kind = 'regular'", [id]);
}

const COLUMNS = `c.id, c.name, c.emoji, c.sort_order, c.type_id, c.deleted_at, c.color, c.system, c.recurring, coalesce(c.system = 'subs', 0) AS by_merchant, c.impulse, c.plan_kind,
    t.name AS type_name, coalesce(t.is_transfer, 0) AS type_is_transfer`;
const FROM = 'FROM categories c LEFT JOIN category_types t ON t.id = c.type_id';
const SELECT = `SELECT ${COLUMNS} ${FROM}`;
// typed first (in type order), untyped last
const ORDER = 'ORDER BY t.id IS NULL, t.sort_order, t.name, c.sort_order, c.name';

/** Live (not deleted) categories. */
export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.all(`${SELECT} WHERE c.deleted_at IS NULL ${ORDER}`);
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const db = await getDb();
  return db.get(`${SELECT} WHERE c.id = ?`, [id]);
}

/** A category's label by its id ("🛒 Еда"); '?' if there is no such category. */
export async function categoryLabelOf(id: number): Promise<string> {
  const c = await getCategory(id);
  return c ? categoryLabel(c) : '?';
}

/** Same name within the same type among live categories; case-insensitive (Cyrillic too, hence JS). */
export async function findCategoryByName(
  name: string,
  typeId: number | null,
  exceptId?: number,
): Promise<Category | undefined> {
  const wanted = name.trim().toLowerCase();
  return (await listCategories()).find(
    (c) => c.id !== exceptId && c.type_id === typeId && c.name.trim().toLowerCase() === wanted,
  );
}

export async function createCategory(
  name: string,
  emoji?: string | null,
  typeId: number | null = null,
  color: string | null = null,
): Promise<number> {
  const db = await getDb();
  // new categories go to the end of the list (before the seeded "Другое" at 99)
  const { lastInsertRowid } = await db.run(
    `INSERT INTO categories (name, emoji, type_id, color, sort_order)
      VALUES (?, ?, ?, ?, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories WHERE sort_order < 99))`,
    [name.trim(), emoji?.trim() || null, typeId, color],
  );
  await db.run('INSERT OR REPLACE INTO category_usage (category_id, usage_count) VALUES (?, 0)', [lastInsertRowid]);
  return lastInsertRowid;
}

export async function updateCategory(
  id: number,
  fields: { name: string; emoji?: string | null; typeId: number | null; color?: string | null },
) {
  const db = await getDb();
  // a system category ("Пополнение счёта", "Между своими картами") keeps its name
  await db.run(
    'UPDATE categories SET name = CASE WHEN system IS NULL THEN ? ELSE name END, emoji = ?, type_id = ?, color = ? WHERE id = ?',
    [fields.name.trim(), fields.emoji?.trim() || null, fields.typeId, fields.color ?? null, id],
  );
}

export async function incrementCategoryUsage(categoryId: number, by = 1, db?: Db) {
  db ??= await getDb();
  await db.run(
    `INSERT INTO category_usage (category_id, usage_count) VALUES (?, ?)
      ON CONFLICT(category_id) DO UPDATE SET usage_count = usage_count + excluded.usage_count`,
    [categoryId, by],
  );
}

/** Most used live categories first. */
export async function topCategories(limit = 3): Promise<Array<Category & { usage_count: number }>> {
  const db = await getDb();
  return db.all(
    `SELECT ${COLUMNS}, coalesce(u.usage_count, 0) AS usage_count
    ${FROM}
    LEFT JOIN category_usage u ON u.category_id = c.id
    WHERE c.deleted_at IS NULL
    ORDER BY usage_count DESC, c.sort_order ASC, c.name ASC
    LIMIT ?`,
    [limit],
  );
}

/**
 * A category's operations count and what was spent in it, per currency: purchases, payments, transfers, cash
 * withdrawals minus refunds not settled on a purchase and deposits (money back), like the stats; split ones by their part.
 */
export async function categorySummary(
  categoryId: number,
): Promise<{ count: number; totals: Array<{ currency: string; amount_minor: number }> }> {
  const db = await getDb();
  const count = (await db.get<{ n: number }>('SELECT count(*) AS n FROM spend_parts WHERE category_id = ?', [
    categoryId,
  ]))!.n;
  const totals = await db.all<{ currency: string; amount_minor: number }>(
    `SELECT currency, sum(${signedSpendSql()}) AS amount_minor FROM spend_parts
      WHERE category_id = ? AND ${categorySpendingSql()}
      GROUP BY currency HAVING sum(${signedSpendSql()}) != 0
      ORDER BY amount_minor DESC`,
    [categoryId],
  );
  return { count, totals };
}
