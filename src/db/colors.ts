import { getDb } from './index';
import { buildCategoryColors } from '../colors';

/** Every category's color, deleted ones too (they keep past months' spending). Same order as listCategories. */
export async function categoryColors(): Promise<Map<number, string>> {
  const db = await getDb();
  const cats = await db.all<{ id: number; type_id: number | null; color: string | null }>(
    `SELECT c.id, c.type_id, c.color FROM categories c LEFT JOIN category_types t ON t.id = c.type_id
      ORDER BY t.id IS NULL, t.sort_order, t.name, c.sort_order, c.name`);
  const types = await db.all<{ id: number; palette: string | null }>('SELECT id, palette FROM category_types ORDER BY sort_order, name');
  return buildCategoryColors(cats, types);
}

export default { categoryColors };
