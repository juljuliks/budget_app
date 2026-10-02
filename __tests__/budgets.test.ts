jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { monthStats, setBudget, listBudgets, monthRange } from '../src/db/budgets';
import {
  createCategory, deleteCategory, findCategoryByName, isTransferCategory, listCategories, setCategoryArchived,
} from '../src/db/categories';
import { addManualTransaction } from '../src/db/transactions';
import { createRule } from '../src/categorize';
import { freshDb } from './helpers';

let seq = 0;
async function tx(kind: string, amount: number, categoryId: number | null, at: Date, currency = 'GEL') {
  const db = await getDb();
  await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, category_id, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', ?, ?, ?, ?, ?, '', ?)`,
    [kind, amount, currency, categoryId, Math.floor(at.getTime() / 1000), `h${seq++}`]);
}
const OCT = (d: number, h = 12) => new Date(2026, 9, d, h);

beforeEach(() => freshDb());

describe('monthStats', () => {
  test('sums expenses, subtracts refunds, ignores deposits, other currencies and other months', async () => {
    await tx('purchase', 1000, 1, OCT(1, 0));      // first second-ish of the month
    await tx('purchase', 500, 1, OCT(31, 23));
    await tx('refund', 200, 1, OCT(5));
    await tx('withdrawal', 3000, 2, OCT(10));
    await tx('transfer', 700, 11, OCT(10));
    await tx('deposit', 99999, null, OCT(10));     // income: excluded
    await tx('purchase', 999, 1, OCT(10), 'USD');  // other currency: separate
    await tx('purchase', 5000, 1, new Date(2026, 8, 30, 23, 59)); // September
    await tx('purchase', 5000, 1, new Date(2026, 10, 1, 0, 0));   // November
    await tx('purchase', 400, null, OCT(3));       // uncategorized

    const s = await monthStats(2026, 9);
    const by = new Map(s.categories.map((c) => [c.category_id, c.spent_minor]));
    expect(by.get(1)).toBe(1300);
    expect(by.get(2)).toBe(3000);
    expect(by.get(11)).toBe(700);
    expect(by.get(null)).toBe(400);
    expect(s.spent_minor).toBe(5400);
    expect(s.other_currencies).toEqual([{ currency: 'USD', spent_minor: 999 }]);
    expect(s.categories.map((c) => c.spent_minor)).toEqual([3000, 1300, 700, 400]); // biggest first
  });

  test('planned categories appear even without spending; plan total ignores archived', async () => {
    await setBudget(3, 10000);
    await setBudget(4, 5000);
    await setCategoryArchived(4, true);
    const s = await monthStats(2026, 9);
    expect(s.planned_minor).toBe(10000);
    expect(s.categories).toEqual([expect.objectContaining({ category_id: 3, spent_minor: 0, limit_minor: 10000 })]);
  });

  test('color rank follows all-time spend, so colors are stable across months', async () => {
    await tx('purchase', 100, 1, new Date(2026, 8, 5));
    await tx('purchase', 9000, 2, new Date(2026, 8, 5));
    await tx('purchase', 50, 1, OCT(5));
    await tx('purchase', 10, 2, OCT(5));
    const rank = new Map((await monthStats(2026, 9)).categories.map((c) => [c.category_id, c.color_rank]));
    expect(rank.get(2)).toBe(0);
    expect(rank.get(1)).toBe(1);
  });

  test('monthRange handles December -> January', () => {
    const [from, to] = monthRange(2026, 11);
    expect(new Date(from * 1000)).toEqual(new Date(2026, 11, 1));
    expect(new Date(to * 1000)).toEqual(new Date(2027, 0, 1));
  });
});

describe('budgets', () => {
  test('set, update, remove with null / 0', async () => {
    await setBudget(1, 1000);
    await setBudget(1, 2500);
    expect(await listBudgets()).toEqual([{ category_id: 1, limit_minor: 2500 }]);
    await setBudget(1, 0);
    expect(await listBudgets()).toEqual([]);
    await setBudget(1, 100);
    await setBudget(1, null);
    expect(await listBudgets()).toEqual([]);
  });
});

describe('categories', () => {
  test('transfer categories are those starting with "перевод", any case', () => {
    expect(isTransferCategory({ name: 'Переводы' })).toBe(true);
    expect(isTransferCategory({ name: ' перевод маме' })).toBe(true);
    expect(isTransferCategory({ name: 'Продукты' })).toBe(false);
  });

  test('duplicate name check is case-insensitive for Cyrillic', async () => {
    expect(await findCategoryByName('продукты')).toMatchObject({ name: 'Продукты' });
    const p = (await findCategoryByName('Продукты'))!;
    expect(await findCategoryByName('ПРОДУКТЫ', p.id)).toBeUndefined(); // renaming itself is fine
  });

  test('new categories go before "Другое"', async () => {
    await createCategory('Спорт', '🏋️');
    const names = (await listCategories()).map((c) => c.name);
    expect(names.slice(-2)).toEqual(['Спорт', 'Другое']);
  });

  test('delete uncategorizes transactions and removes rules, plan, usage', async () => {
    const id = await createCategory('Спорт');
    await tx('purchase', 100, id, OCT(1));
    await createRule('exact', 'GYM', id);
    await setBudget(id, 1000);
    await deleteCategory(id);
    const db = await getDb();
    expect(await db.get('SELECT category_id FROM transactions')).toEqual({ category_id: null });
    expect(await db.get('SELECT * FROM merchant_rules')).toBeUndefined();
    expect(await listBudgets()).toEqual([]);
    expect(await db.get('SELECT * FROM categories WHERE id = ?', [id])).toBeUndefined();
  });

  test('archived categories are hidden from the picker list', async () => {
    await setCategoryArchived(1, true);
    expect((await listCategories()).map((c) => c.id)).not.toContain(1);
    expect((await listCategories(500, { includeArchived: true })).map((c) => c.id)).toContain(1);
  });
});

describe('addManualTransaction', () => {
  test('stores a manual purchase that counts in stats', async () => {
    const id = await addManualTransaction({ amount_minor: 1250, category_id: 1, description: ' рынок ', occurred_at: Math.floor(OCT(2).getTime() / 1000) });
    await addManualTransaction({ amount_minor: 300, category_id: null, occurred_at: Math.floor(OCT(2).getTime() / 1000) });
    const row = await (await getDb()).get('SELECT * FROM transactions WHERE id = ?', [id]);
    expect(row).toMatchObject({ bank: 'manual', kind: 'purchase', amount_minor: 1250, currency: 'GEL', raw_merchant: 'рынок', category_source: 'user' });
    expect((await monthStats(2026, 9)).spent_minor).toBe(1550);
  });
});
