import { getDb } from './index';

export type CategoryType = {
  id: number; name: string; is_transfer: number; sort_order: number;
  /** palette key (src/colors.ts); null = by position */
  palette: string | null;
};

export async function listCategoryTypes(): Promise<CategoryType[]> {
  const db = await getDb();
  return db.all('SELECT id, name, is_transfer, sort_order, palette FROM category_types ORDER BY sort_order, name');
}

/** Case-insensitive (Cyrillic too, hence JS) duplicate check. */
export async function findCategoryTypeByName(name: string, exceptId?: number): Promise<CategoryType | undefined> {
  const wanted = name.trim().toLowerCase();
  return (await listCategoryTypes()).find((t) => t.id !== exceptId && t.name.trim().toLowerCase() === wanted);
}

export async function createCategoryType(name: string): Promise<number> {
  const db = await getDb();
  const { lastInsertRowid } = await db.run(
    `INSERT INTO category_types (name, sort_order)
      VALUES (?, (SELECT coalesce(max(sort_order), 0) + 1 FROM category_types WHERE sort_order < 100))`,
    [name.trim()]);
  return lastInsertRowid;
}

export async function setCategoryTypePalette(id: number, palette: string | null) {
  const db = await getDb();
  await db.run('UPDATE category_types SET palette = ? WHERE id = ?', [palette, id]);
}

export async function renameCategoryType(id: number, name: string) {
  const db = await getDb();
  await db.run('UPDATE category_types SET name = ? WHERE id = ?', [name.trim(), id]);
}

/** Categories of the type become untyped. The transfer type can't be deleted (it drives transfer suggestions). */
export async function deleteCategoryType(id: number) {
  const db = await getDb();
  await db.transaction(async () => {
    const t = await db.get<{ is_transfer: number }>('SELECT is_transfer FROM category_types WHERE id = ?', [id]);
    if (!t) return;
    if (t.is_transfer) throw new Error('transfer type cannot be deleted');
    await db.run('UPDATE categories SET type_id = NULL WHERE type_id = ?', [id]);
    await db.run('DELETE FROM category_types WHERE id = ?', [id]);
  });
}

export async function countCategoriesOfType(id: number): Promise<number> {
  const db = await getDb();
  return (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories WHERE type_id = ? AND deleted_at IS NULL', [id]))!.n;
}

export async function getTransferTypeId(): Promise<number | null> {
  const db = await getDb();
  return (await db.get<{ id: number }>('SELECT id FROM category_types WHERE is_transfer = 1 LIMIT 1'))?.id ?? null;
}

export default {
  listCategoryTypes, findCategoryTypeByName, createCategoryType, renameCategoryType, deleteCategoryType, countCategoriesOfType,
  getTransferTypeId,
};
