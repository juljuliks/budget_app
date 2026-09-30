import { getDb } from './index';

export type Category = {
  id: number;
  name: string;
  emoji: string | null;
  sort_order: number;
  is_archived: number;
};

export async function listCategories(limit = 50): Promise<Category[]> {
  const db = await getDb();
  return db.all('SELECT id, name, emoji, sort_order, is_archived FROM categories WHERE is_archived = 0 ORDER BY sort_order, name LIMIT ?', [limit]);
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const db = await getDb();
  return db.get('SELECT id, name, emoji, sort_order, is_archived FROM categories WHERE id = ?', [id]);
}

/** Case-insensitive lookup (NOCASE only folds ASCII, so compare lower() on both sides). */
export async function findCategoryByName(name: string): Promise<Category | undefined> {
  const db = await getDb();
  return db.get('SELECT id, name, emoji, sort_order, is_archived FROM categories WHERE lower(name) = lower(?)', [name]);
}

export async function createCategory(name: string, emoji?: string, sortOrder = 0): Promise<number> {
  const db = await getDb();
  const { lastInsertRowid } = await db.run(
    'INSERT INTO categories (name, emoji, sort_order) VALUES (?, ?, ?)', [name, emoji || null, sortOrder]);
  await db.run('INSERT OR REPLACE INTO category_usage (category_id, usage_count) VALUES (?, 0)', [lastInsertRowid]);
  return lastInsertRowid;
}

export async function incrementCategoryUsage(categoryId: number, by = 1) {
  const db = await getDb();
  await db.run(
    `INSERT INTO category_usage (category_id, usage_count) VALUES (?, ?)
      ON CONFLICT(category_id) DO UPDATE SET usage_count = usage_count + excluded.usage_count`,
    [categoryId, by]);
}

export async function topCategories(limit = 3): Promise<Array<Category & { usage_count: number }>> {
  const db = await getDb();
  return db.all(`SELECT c.id, c.name, c.emoji, c.sort_order, c.is_archived, coalesce(u.usage_count, 0) AS usage_count
    FROM categories c
    LEFT JOIN category_usage u ON u.category_id = c.id
    WHERE c.is_archived = 0
    ORDER BY usage_count DESC, c.sort_order ASC, c.name ASC
    LIMIT ?`, [limit]);
}

export default { listCategories, getCategory, findCategoryByName, createCategory, incrementCategoryUsage, topCategories };
