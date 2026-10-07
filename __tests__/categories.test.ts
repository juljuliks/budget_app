jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { openDatabase } from '../src/db/driver';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import {
  categoryLabel, countPastTransactionsOfCategory, createCategory, currentTransactionsOfCategory, deleteCategory,
  findCategoryByName, getCategory, isTransferCategory, listCategories, moveTransactionsOutOfCategory, topCategories, updateCategory,
} from '../src/db/categories';
import {
  countCategoriesOfType, createCategoryType, deleteCategoryType, findCategoryTypeByName, getTransferTypeId,
  listCategoryTypes, renameCategoryType,
} from '../src/db/categoryTypes';
import { createRule } from '../src/categorize';
import { monthStats, ymOf } from '../src/db/plans';
import { freshDb } from './helpers';

const NOW = '2026-10';
const at = (y: number, m: number, d = 10) => Math.floor(new Date(y, m, d, 12).getTime() / 1000);
let seq = 0;
async function tx(categoryId: number | null, occurredAt: number, amount = 100) {
  const db = await getDb();
  const { lastInsertRowid } = await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', ?, 'GEL', ?, 'user', ?, '', ?)`, [amount, categoryId, occurredAt, `h${seq++}`]);
  return lastInsertRowid;
}

beforeEach(() => freshDb());

describe('types', () => {
  test('fresh DB has the transfer type with the seeded category renamed to avoid "Переводы: Переводы"', async () => {
    const transfer = await getTransferTypeId();
    expect(await listCategoryTypes()).toEqual([{ id: transfer, name: 'Переводы', is_transfer: 1, sort_order: 100, palette: null }]);
    const cats = (await listCategories()).filter(isTransferCategory);
    expect(cats.map(categoryLabel)).toEqual(['🔁 Переводы: Прочие']);
    expect(isTransferCategory(cats[0])).toBe(true);
  });

  test('label: emoji + type prefix', () => {
    expect(categoryLabel({ emoji: '🎸', name: 'Гитара', type_name: 'Хобби' })).toBe('🎸 Хобби: Гитара');
    expect(categoryLabel({ emoji: null, name: 'Еда', type_name: null })).toBe('Еда');
  });

  test('create, rename, duplicate check, delete makes categories untyped', async () => {
    const hobby = await createCategoryType('Хобби');
    expect(await findCategoryTypeByName('хобби')).toMatchObject({ id: hobby });
    const id = await createCategory('Гитара', '🎸', hobby);
    expect(await countCategoriesOfType(hobby)).toBe(1);

    await renameCategoryType(hobby, 'Увлечения');
    expect(categoryLabel((await getCategory(id))!)).toBe('🎸 Увлечения: Гитара');

    await deleteCategoryType(hobby);
    expect((await getCategory(id))!.type_id).toBeNull();
    expect((await listCategoryTypes()).map((t) => t.name)).toEqual(['Переводы']);
  });

  test('the transfer type cannot be deleted', async () => {
    await expect(deleteCategoryType((await getTransferTypeId())!)).rejects.toHaveProperty('message', expect.stringContaining('transfer'));
  });

  test('categories are listed by type order, untyped last', async () => {
    const hobby = await createCategoryType('Хобби');
    await createCategory('Гитара', null, hobby);
    const labels = (await listCategories()).map((c) => c.type_name ?? '-');
    expect(labels.slice(0, 2)).toEqual(['Хобби', 'Переводы']);
    expect(labels[labels.length - 1]).toBe('-');
  });
});

describe('names', () => {
  test('same name allowed under different types, not within one (case-insensitive, Cyrillic)', async () => {
    const hobby = await createCategoryType('Хобби');
    await createCategory('Разное', null, hobby);
    expect(await findCategoryByName('разное', hobby)).toBeDefined();
    expect(await findCategoryByName('разное', null)).toBeUndefined();
    expect(await findCategoryByName('ПРОДУКТЫ', null)).toMatchObject({ name: 'Продукты' });
  });

  test('editing keeps id and may change type', async () => {
    const hobby = await createCategoryType('Хобби');
    await updateCategory(1, { name: 'Еда', emoji: '🍎', typeId: hobby });
    expect(await getCategory(1)).toMatchObject({ name: 'Еда', emoji: '🍎', type_name: 'Хобби' });
  });

  test('new categories go before "Другое"', async () => {
    await createCategory('Спорт', '🏋️');
    const names = (await listCategories()).filter((c) => !c.type_id && !c.system).map((c) => c.name);
    expect(names.slice(-2)).toEqual(['Спорт', 'Другое']);
  });
});

describe('moveTransactionsOutOfCategory (deleting a category step by step)', () => {
  test('moved transactions take the new category, their merchants\' rules follow; others stay', async () => {
    const db = await getDb();
    const a = await tx(1, at(2026, 9, 2));
    const b = await tx(1, at(2026, 9, 3));
    const c = await tx(1, at(2026, 9, 4));
    await db.run("UPDATE transactions SET merchant_key = 'SPAR', category_source = 'rule' WHERE id = ?", [a]);
    await db.run("UPDATE transactions SET merchant_key = 'WOLT' WHERE id IN (?, ?)", [b, c]);
    await createRule('exact', 'SPAR', 1);
    await createRule('exact', 'WOLT', 1);
    await createRule('exact', 'IKEA', 1);

    await moveTransactionsOutOfCategory([a], 1, 2);
    await moveTransactionsOutOfCategory([b], 1, null);

    const rows = await db.all('SELECT id, category_id, category_source FROM transactions ORDER BY id');
    expect(rows).toEqual([
      { id: a, category_id: 2, category_source: 'rule' }, // still follows SPAR, whose rule moved
      { id: b, category_id: null, category_source: null },
      { id: c, category_id: 1, category_source: 'user' },
    ]);
    const rules = await db.all('SELECT pattern, category_id FROM merchant_rules ORDER BY pattern');
    expect(rules).toEqual([{ pattern: 'IKEA', category_id: 1 }, { pattern: 'SPAR', category_id: 2 }]);
  });
});

describe('deleteCategory', () => {
  test('moves this month\'s transactions and rules to the target, past months keep the category', async () => {
    const past = await tx(1, at(2026, 8));
    const current = await tx(1, at(2026, 9, 2));
    await createRule('exact', 'SPAR', 1);
    expect((await currentTransactionsOfCategory(1, NOW)).map((t) => t.id)).toEqual([current]);
    expect(await countPastTransactionsOfCategory(1, NOW)).toBe(1);

    await deleteCategory(1, 2, NOW);

    const db = await getDb();
    expect(await db.get('SELECT category_id FROM transactions WHERE id = ?', [past])).toEqual({ category_id: 1 });
    expect(await db.get('SELECT category_id FROM transactions WHERE id = ?', [current])).toEqual({ category_id: 2 });
    expect(await db.get('SELECT category_id FROM merchant_rules')).toEqual({ category_id: 2 });
    // soft-deleted: hidden from pickers and suggestions, still named in past stats
    expect((await listCategories()).map((c) => c.id)).not.toContain(1);
    expect((await topCategories(100)).map((c) => c.id)).not.toContain(1);
    expect((await getCategory(1))!.deleted_at).not.toBeNull();
    expect((await monthStats(2026, 8)).categories).toEqual([expect.objectContaining({ category_id: 1, name: 'Продукты', spent_minor: 100 })]);
  });

  test('moved to another category, a rule-picked transaction keeps following its merchant, a hand-picked one stays hand-picked', async () => {
    const byRule = await tx(1, at(2026, 9, 2));
    const byHand = await tx(1, at(2026, 9, 3));
    const db = await getDb();
    await db.run("UPDATE transactions SET category_source = 'rule' WHERE id = ?", [byRule]);
    await deleteCategory(1, 2, NOW);
    expect(await db.get('SELECT category_id, category_source FROM transactions WHERE id = ?', [byRule])).toEqual({ category_id: 2, category_source: 'rule' });
    expect(await db.get('SELECT category_id, category_source FROM transactions WHERE id = ?', [byHand])).toEqual({ category_id: 2, category_source: 'user' });
  });

  test('without a target this month\'s transactions become uncategorized and rules are removed', async () => {
    const current = await tx(1, at(2026, 9, 2));
    await createRule('exact', 'SPAR', 1);
    await deleteCategory(1, null, NOW);
    const db = await getDb();
    expect(await db.get('SELECT category_id, category_source FROM transactions WHERE id = ?', [current])).toEqual({ category_id: null, category_source: null });
    expect(await db.get('SELECT * FROM merchant_rules')).toBeUndefined();
  });

  test('a category with no past trace is removed completely', async () => {
    const id = await createCategory('Спорт');
    await tx(id, at(2026, 9, 2));
    await deleteCategory(id, null, NOW);
    expect(await getCategory(id)).toBeUndefined();
  });

  test('a deleted name can be reused', async () => {
    await tx(1, at(2026, 8));
    await deleteCategory(1, null, NOW);
    expect(await findCategoryByName('Продукты', null)).toBeUndefined();
    await createCategory('Продукты');
    expect((await listCategories()).filter((c) => c.name === 'Продукты')).toHaveLength(1);
  });
});

test('stats are grouped by type: types first, then untyped, then uncategorized', async () => {
  const hobby = await createCategoryType('Хобби');
  const guitar = await createCategory('Гитара', null, hobby);
  const transfer = (await listCategories()).filter(isTransferCategory)[0].id;
  await tx(guitar, at(2026, 9), 300);
  await tx(transfer, at(2026, 9), 500);
  await tx(1, at(2026, 9), 200);
  await tx(null, at(2026, 9), 50);
  const s = await monthStats(2026, 9);
  expect(s.groups.map((g) => [g.title, g.spent_minor])).toEqual([
    ['Хобби', 300], ['Переводы', 500], ['Без раздела', 200], ['Без категории', 50],
  ]);
  expect(ymOf(2026, 9)).toBe(NOW);
});

test('migration 4 types existing "Перевод…" categories and turns archived into deleted', async () => {
  const db = openDatabase(':memory:');
  await migrate(db, MIGRATIONS.slice(0, 3));
  await db.run("INSERT INTO categories (name, emoji, is_archived) VALUES ('Перевод маме', '👩', 0), ('Старое', NULL, 1)");
  await migrate(db);
  const rows = await db.all<{ name: string; type_id: number | null; deleted_at: number | null }>(
    "SELECT name, type_id, deleted_at FROM categories WHERE name IN ('Перевод маме', 'Старое', 'Прочие') ORDER BY name");
  expect(rows).toEqual([
    { name: 'Перевод маме', type_id: 1, deleted_at: null },
    { name: 'Прочие', type_id: 1, deleted_at: null },
    { name: 'Старое', type_id: null, deleted_at: expect.any(Number) },
  ]);
});
