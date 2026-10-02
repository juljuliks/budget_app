import { getDb } from './index';

export type Category = {
  id: number;
  name: string;
  emoji: string | null;
  sort_order: number;
  is_archived: number;
};

const COLS = 'id, name, emoji, sort_order, is_archived';

/** Categories whose name starts with "Перевод…" are the only ones offered for money transfers. */
export function isTransferCategory(c: Pick<Category, 'name'>): boolean {
  // JS toLowerCase: SQLite lower() only folds ASCII, not Cyrillic
  return c.name.trim().toLowerCase().startsWith('перевод');
}

export async function listCategories(limit = 500, opts: { includeArchived?: boolean } = {}): Promise<Category[]> {
  const db = await getDb();
  const where = opts.includeArchived ? '' : 'WHERE is_archived = 0';
  return db.all(`SELECT ${COLS} FROM categories ${where} ORDER BY is_archived, sort_order, name LIMIT ?`, [limit]);
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const db = await getDb();
  return db.get(`SELECT ${COLS} FROM categories WHERE id = ?`, [id]);
}

/** Case-insensitive lookup, done in JS because SQLite lower() doesn't fold Cyrillic. */
export async function findCategoryByName(name: string, exceptId?: number): Promise<Category | undefined> {
  const wanted = name.trim().toLowerCase();
  const all = await listCategories(10_000, { includeArchived: true });
  return all.find((c) => c.id !== exceptId && c.name.trim().toLowerCase() === wanted);
}

export async function createCategory(name: string, emoji?: string): Promise<number> {
  const db = await getDb();
  // new categories go to the end of the list
  const { lastInsertRowid } = await db.run(
    `INSERT INTO categories (name, emoji, sort_order)
      VALUES (?, ?, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories WHERE sort_order < 99))`,
    [name.trim(), emoji?.trim() || null]);
  await db.run('INSERT OR REPLACE INTO category_usage (category_id, usage_count) VALUES (?, 0)', [lastInsertRowid]);
  return lastInsertRowid;
}

export async function updateCategory(id: number, fields: { name: string; emoji?: string | null }) {
  const db = await getDb();
  await db.run('UPDATE categories SET name = ?, emoji = ? WHERE id = ?', [fields.name.trim(), fields.emoji?.trim() || null, id]);
}

/** Archived categories are hidden from pickers and suggestions but keep their transactions. */
export async function setCategoryArchived(id: number, archived: boolean) {
  const db = await getDb();
  await db.run('UPDATE categories SET is_archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
}

/** Deletes the category; its transactions become uncategorized, its rules and plan are removed. */
export async function deleteCategory(id: number) {
  const db = await getDb();
  await db.transaction(async () => {
    await db.run('UPDATE transactions SET category_id = NULL, category_source = NULL WHERE category_id = ?', [id]);
    await db.run('DELETE FROM merchant_rules WHERE category_id = ?', [id]);
    await db.run('DELETE FROM budgets WHERE category_id = ?', [id]);
    await db.run('DELETE FROM category_usage WHERE category_id = ?', [id]);
    await db.run('DELETE FROM categories WHERE id = ?', [id]);
  });
}

export async function countTransactionsInCategory(id: number): Promise<number> {
  const db = await getDb();
  return (await db.get<{ n: number }>('SELECT count(*) AS n FROM transactions WHERE category_id = ?', [id]))!.n;
}

export async function incrementCategoryUsage(categoryId: number, by = 1) {
  const db = await getDb();
  await db.run(
    `INSERT INTO category_usage (category_id, usage_count) VALUES (?, ?)
      ON CONFLICT(category_id) DO UPDATE SET usage_count = usage_count + excluded.usage_count`,
    [categoryId, by]);
}

/** Most used active categories first. */
export async function topCategories(limit = 3): Promise<Array<Category & { usage_count: number }>> {
  const db = await getDb();
  return db.all(`SELECT c.id, c.name, c.emoji, c.sort_order, c.is_archived, coalesce(u.usage_count, 0) AS usage_count
    FROM categories c
    LEFT JOIN category_usage u ON u.category_id = c.id
    WHERE c.is_archived = 0
    ORDER BY usage_count DESC, c.sort_order ASC, c.name ASC
    LIMIT ?`, [limit]);
}

export default {
  listCategories, getCategory, findCategoryByName, createCategory, updateCategory, setCategoryArchived,
  deleteCategory, countTransactionsInCategory, incrementCategoryUsage, topCategories, isTransferCategory,
};
