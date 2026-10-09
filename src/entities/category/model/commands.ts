// The category's writes: each one tells the screens the data changed.
import { createCategory, updateCategory } from '@/db/categories';
import { createCategoryType, renameCategoryType, setCategoryTypePalette } from '@/db/categoryTypes';
import { emitTransactionsChanged } from '@/events';

export type CategoryFields = { name: string; emoji: string; typeId: number | null; color: string | null };

/** Creates the category (no `id`) or saves it; its id. */
export async function saveCategory(id: number | undefined, v: CategoryFields): Promise<number> {
  const saved = id ?? await createCategory(v.name, v.emoji, v.typeId, v.color);
  if (id !== undefined) await updateCategory(id, { name: v.name, emoji: v.emoji, typeId: v.typeId, color: v.color });
  emitTransactionsChanged();
  return saved;
}

/** Creates the section (no `id`) or renames it, with its palette; its id. */
export async function saveCategoryType(id: number | undefined, name: string, palette: string): Promise<number> {
  const saved = id ?? await createCategoryType(name);
  if (id !== undefined) await renameCategoryType(id, name);
  await setCategoryTypePalette(saved, palette);
  emitTransactionsChanged();
  return saved;
}
