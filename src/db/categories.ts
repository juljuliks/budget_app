import { getDb } from './index';
import { currentYm, monthStart } from './plans';

export type Category = {
  id: number;
  name: string;
  emoji: string | null;
  sort_order: number;
  type_id: number | null;
  type_name: string | null;
  /** 1 when the category's type is the transfer type: offered for money transfers (see isTransferCategory) */
  type_is_transfer: number;
  deleted_at: number | null;
};

const COLUMNS = `c.id, c.name, c.emoji, c.sort_order, c.type_id, c.deleted_at,
    t.name AS type_name, coalesce(t.is_transfer, 0) AS type_is_transfer`;
const FROM = 'FROM categories c LEFT JOIN category_types t ON t.id = c.type_id';
const SELECT = `SELECT ${COLUMNS} ${FROM}`;
// typed first (in type order), untyped last
const ORDER = 'ORDER BY t.id IS NULL, t.sort_order, t.name, c.sort_order, c.name';

export function isTransferCategory(c: Pick<Category, 'type_is_transfer'>): boolean {
  return c.type_is_transfer === 1;
}

/** "💸 Переводы: Маме" */
export function categoryLabel(c: { emoji?: string | null; name: string; type_name?: string | null }): string {
  return `${c.emoji || ''} ${c.type_name ? `${c.type_name}: ` : ''}${c.name}`.trim();
}

/** Category label of a transaction row (its joined category_* columns); null when uncategorized. */
export function txCategoryLabel(tx: { category_id: number | null; category_name: string | null; category_emoji: string | null; category_type_name: string | null }): string | null {
  if (tx.category_id === null || tx.category_name === null) return null;
  return categoryLabel({ emoji: tx.category_emoji, name: tx.category_name, type_name: tx.category_type_name });
}

/** Live (not deleted) categories. */
export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.all(`${SELECT} WHERE c.deleted_at IS NULL ${ORDER}`);
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const db = await getDb();
  return db.get(`${SELECT} WHERE c.id = ?`, [id]);
}

/** Same name within the same type among live categories; case-insensitive (Cyrillic too, hence JS). */
export async function findCategoryByName(name: string, typeId: number | null, exceptId?: number): Promise<Category | undefined> {
  const wanted = name.trim().toLowerCase();
  return (await listCategories()).find(
    (c) => c.id !== exceptId && c.type_id === typeId && c.name.trim().toLowerCase() === wanted);
}

export async function createCategory(name: string, emoji?: string | null, typeId: number | null = null): Promise<number> {
  const db = await getDb();
  // new categories go to the end of the list (before the seeded "Другое" at 99)
  const { lastInsertRowid } = await db.run(
    `INSERT INTO categories (name, emoji, type_id, sort_order)
      VALUES (?, ?, ?, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories WHERE sort_order < 99))`,
    [name.trim(), emoji?.trim() || null, typeId]);
  await db.run('INSERT OR REPLACE INTO category_usage (category_id, usage_count) VALUES (?, 0)', [lastInsertRowid]);
  return lastInsertRowid;
}

export async function updateCategory(id: number, fields: { name: string; emoji?: string | null; typeId: number | null }) {
  const db = await getDb();
  await db.run('UPDATE categories SET name = ?, emoji = ?, type_id = ? WHERE id = ?',
    [fields.name.trim(), fields.emoji?.trim() || null, fields.typeId, id]);
}

/** Transactions of the category from the current month on (those a delete would move). */
export async function currentTransactionsOfCategory(id: number, nowYm = currentYm()) {
  const db = await getDb();
  const from = monthStart(nowYm);
  return db.all<{ id: number; amount_minor: number; currency: string; kind: string; raw_merchant: string | null; occurred_at: number }>(
    `SELECT id, amount_minor, currency, kind, raw_merchant, occurred_at FROM transactions
      WHERE category_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC`, [id, from]);
}

export async function countPastTransactionsOfCategory(id: number, nowYm = currentYm()): Promise<number> {
  const db = await getDb();
  const from = monthStart(nowYm);
  return (await db.get<{ n: number }>(
    'SELECT count(*) AS n FROM transactions WHERE category_id = ? AND occurred_at < ?', [id, from]))!.n;
}

/**
 * Deletes a category from the current month on. Its transactions of the current month (and later)
 * move to `targetId` (or become uncategorized), merchant rules follow them; past months keep the
 * category so history doesn't change. A category with no past trace is removed completely.
 */
export async function deleteCategory(id: number, targetId: number | null, nowYm = currentYm()) {
  const db = await getDb();
  const from = monthStart(nowYm);
  await db.transaction(async () => {
    await db.run(
      `UPDATE transactions SET category_id = ?, category_source = ?
        WHERE category_id = ? AND occurred_at >= ?`,
      [targetId, targetId === null ? null : 'user', id, from]);
    if (targetId === null) {
      await db.run('DELETE FROM merchant_rules WHERE category_id = ?', [id]);
    } else {
      await db.run('UPDATE merchant_rules SET category_id = ? WHERE category_id = ?', [targetId, id]);
    }
    await db.run('DELETE FROM plan_items WHERE category_id = ? AND ym >= ?', [id, nowYm]);
    await db.run('DELETE FROM category_usage WHERE category_id = ?', [id]);

    const pastTx = await db.get('SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1', [id]);
    const pastPlan = await db.get('SELECT 1 FROM plan_items WHERE category_id = ? LIMIT 1', [id]);
    if (pastTx || pastPlan) {
      await db.run('UPDATE categories SET deleted_at = ? WHERE id = ?', [Math.floor(Date.now() / 1000), id]);
    } else {
      await db.run('DELETE FROM categories WHERE id = ?', [id]);
    }
  });
}

export async function incrementCategoryUsage(categoryId: number, by = 1) {
  const db = await getDb();
  await db.run(
    `INSERT INTO category_usage (category_id, usage_count) VALUES (?, ?)
      ON CONFLICT(category_id) DO UPDATE SET usage_count = usage_count + excluded.usage_count`,
    [categoryId, by]);
}

/** Most used live categories first. */
export async function topCategories(limit = 3): Promise<Array<Category & { usage_count: number }>> {
  const db = await getDb();
  return db.all(`SELECT ${COLUMNS}, coalesce(u.usage_count, 0) AS usage_count
    ${FROM}
    LEFT JOIN category_usage u ON u.category_id = c.id
    WHERE c.deleted_at IS NULL
    ORDER BY usage_count DESC, c.sort_order ASC, c.name ASC
    LIMIT ?`, [limit]);
}

export default {
  listCategories, getCategory, findCategoryByName, createCategory, updateCategory, deleteCategory,
  currentTransactionsOfCategory, countPastTransactionsOfCategory, incrementCategoryUsage, topCategories,
  isTransferCategory, categoryLabel, txCategoryLabel,
};
