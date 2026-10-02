jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { categorySearchQuery, deleteTransaction, listTransactionsPage, normalizeForSearch, searchTransactions } from '../src/db/transactions';
import { createCategory } from '../src/db/categories';
import { createCategoryType } from '../src/db/categoryTypes';
import { assignCategory, assignCategoryToMany } from '../src/assign';
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

describe('deleteTransaction', () => {
  test('removes the row and the same SMS can be ingested again later', async () => {
    await insertTx(1, 1000, 'SPAR');
    await deleteTransaction(1);
    expect(await (await getDb()).get('SELECT * FROM transactions')).toBeUndefined();
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


describe('searchTransactions', () => {
  async function seed() {
    const db = await getDb();
    const hobby = await createCategoryType('Хобби');
    const guitar = await createCategory('Гитара', '🎸', hobby);
    await db.run(
      `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, category_id, occurred_at, raw_sms, sms_hash) VALUES
        ('tbc', 'purchase', 4400, 'GEL', 'AdamDent LLC', NULL, 1000, '44.00GEL\n(*XXXX)\nAdamDent LLC', 'a'),
        ('tbc', 'purchase', 1034, 'GEL', 'SPAR', 1, 2000, '10.34GEL\n(*XXXX)\nSPAR', 'b'),
        ('manual', 'purchase', 5000, 'GEL', 'струны Ёлка', ?, 3000, '', 'c')`, [guitar]);
  }

  test.each([
    ['adamdent', ['AdamDent LLC']],          // SMS text, case-insensitive
    ['10.34', ['SPAR']],                     // amount inside the SMS
    ['продукты', ['SPAR']],                  // category name, Cyrillic case-insensitive
    ['ХОББИ', ['струны Ёлка']],              // category type
    ['елка', ['струны Ёлка']],               // ё = е
    ['гитара струны', ['струны Ёлка']],      // every word must match, in any field
    ['gel', ['SPAR', 'AdamDent LLC']],       // manual tx has no SMS text, so no "GEL" in it
    ['nothing', []],
  ])('%j', async (q, expected) => {
    await seed();
    const merchants = (await searchTransactions(q)).map((r) => r.raw_merchant);
    expect(merchants).toEqual(expected);
  });

  test('empty query returns nothing (list shows the normal feed)', async () => {
    await seed();
    expect(await searchTransactions('   ')).toEqual([]);
  });

  test('stats -> transactions: the category query finds that category, "Без категории" finds uncategorized', async () => {
    await seed();
    const guitar = (await searchTransactions('гитара'))[0];
    const q = categorySearchQuery({ name: guitar.category_name!, type_name: guitar.category_type_name, category_id: guitar.category_id });
    expect(q).toBe('Хобби Гитара');
    expect((await searchTransactions(q)).map((r) => r.raw_merchant)).toEqual(['струны Ёлка']);
    expect(categorySearchQuery({ name: 'Без категории', category_id: null })).toBe('Без категории');
    expect((await searchTransactions('Без категории')).map((r) => r.raw_merchant)).toEqual(['AdamDent LLC']);
  });

  test('normalizeForSearch', () => {
    expect(normalizeForSearch('  Ёжик  В тумане ')).toBe('ежик в тумане');
  });
});

describe('assignCategoryToMany', () => {
  test('sets the category on all given transactions, no merchant rules, notifies once', async () => {
    for (let i = 1; i <= 3; i++) await insertTx(i, 1000 + i, 'SPAR');
    const listener = jest.fn();
    const off = onTransactionsChanged(listener);
    await assignCategoryToMany([1, 3], 5);
    off();
    const db = await getDb();
    expect(await db.all('SELECT id, category_id, category_source FROM transactions ORDER BY id')).toEqual([
      { id: 1, category_id: 5, category_source: 'user' },
      { id: 2, category_id: null, category_source: null },
      { id: 3, category_id: 5, category_source: 'user' },
    ]);
    expect(await db.get('SELECT * FROM merchant_rules')).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
