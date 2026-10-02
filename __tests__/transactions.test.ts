jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { listTransactionsPage } from '../src/db/transactions';
import { assignCategory } from '../src/assign';
import {
  createCategory, deleteCategory, findCategoryByName, isTransferCategory, listCategories, setCategoryArchived,
} from '../src/db/categories';
import { onTransactionsChanged } from '../src/events';
import { freshDb } from './helpers';

async function insertTx(i: number, occurredAt: number, merchant = `SHOP ${i}`) {
  const db = await getDb();
  await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', ?, 'GEL', ?, ?, ?, 'sms', ?)`,
    [100 + i, merchant, merchant, occurredAt, `hash${i}`]);
}

beforeEach(() => freshDb());

describe('listTransactionsPage', () => {
  test('pages through everything newest-first without gaps or duplicates, incl. equal timestamps', async () => {
    // 120 rows, three share each timestamp so page boundaries fall inside ties
    for (let i = 0; i < 120; i++) await insertTx(i, 1_000_000 + Math.floor(i / 3) * 60);

    const seen: number[] = [];
    let cursor = null;
    let pages = 0;
    do {
      const page: Awaited<ReturnType<typeof listTransactionsPage>> = await listTransactionsPage(cursor, 50);
      seen.push(...page.rows.map((r) => r.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(120);
    const all = await (await getDb()).all<{ id: number }>('SELECT id FROM transactions ORDER BY occurred_at DESC, id DESC');
    expect(seen).toEqual(all.map((r) => r.id));
  });

  test('a page shorter than the limit has no next cursor', async () => {
    for (let i = 0; i < 3; i++) await insertTx(i, 1000 + i);
    const page = await listTransactionsPage(null, 50);
    expect(page.rows).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  test('new rows arriving between pages do not shift the next page', async () => {
    for (let i = 0; i < 4; i++) await insertTx(i, 1000 + i);
    const first = await listTransactionsPage(null, 2);
    await insertTx(99, 5000); // newer SMS arrives
    const second = await listTransactionsPage(first.nextCursor, 2);
    expect(second.rows.map((r) => r.amount_minor)).toEqual([101, 100]);
  });
});

describe('assignCategory', () => {
  test('without applyToMerchant only this transaction changes and no rule is created', async () => {
    await insertTx(1, 1000, 'SPAR');
    await insertTx(2, 2000, 'SPAR');
    await assignCategory(1, 4, { applyToMerchant: false });
    const db = await getDb();
    expect((await db.all('SELECT category_id FROM transactions ORDER BY id')).map((r) => r.category_id)).toEqual([4, null]);
    expect(await db.get('SELECT * FROM merchant_rules')).toBeUndefined();
  });

  test('clearing the category resets source and notifies listeners', async () => {
    await insertTx(1, 1000, 'SPAR');
    const listener = jest.fn();
    const off = onTransactionsChanged(listener);
    await assignCategory(1, 4);
    await assignCategory(1, null);
    off();
    expect(await (await getDb()).get('SELECT category_id, category_source FROM transactions')).toEqual({ category_id: null, category_source: null });
    expect(listener).toHaveBeenCalledTimes(2);
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
    const p = await findCategoryByName('Продукты');
    expect(await findCategoryByName('ПРОДУКТЫ', p!.id)).toBeUndefined();
  });

  test('new categories go before "Другое"', async () => {
    await createCategory('Спорт', '🏋️');
    const names = (await listCategories()).map((c) => c.name);
    expect(names.slice(-2)).toEqual(['Спорт', 'Другое']);
  });

  test('delete uncategorizes transactions and removes rules', async () => {
    const id = await createCategory('Спорт');
    await insertTx(1, 1000, 'GYM');
    await assignCategory(1, id);
    await deleteCategory(id);
    const db = await getDb();
    expect(await db.get('SELECT category_id FROM transactions')).toEqual({ category_id: null });
    expect(await db.get('SELECT * FROM merchant_rules')).toBeUndefined();
  });

  test('archived categories are hidden from the picker list', async () => {
    await setCategoryArchived(1, true);
    expect((await listCategories()).map((c) => c.id)).not.toContain(1);
    expect((await listCategories(500, { includeArchived: true })).map((c) => c.id)).toContain(1);
  });
});
