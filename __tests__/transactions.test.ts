jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import {
  addManualTransaction, countUnseenTransactions, deleteTransaction, isUnread, listTransactionsPage, markTransactionSeen,
  normalizeForSearch, searchTransactions, listTransactionsFiltered, categoriesWithTransactions,
} from '../src/db/transactions';
import { rangeToUnix } from '../src/ui/dateRange';
import { createCategory } from '../src/db/categories';
import { createCategoryType } from '../src/db/categoryTypes';
import { assignCategory, assignCategoryToMany } from '../src/assign';
import { onTransactionsChanged } from '../src/events';
import { ingestSms } from '../src/ingest';
import { openDatabase } from '../src/db/driver';
import { migrate, MIGRATIONS } from '../src/db/migrations';
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

  test('type + name finds that category, "Без категории" finds uncategorized', async () => {
    await seed();
    expect((await searchTransactions('Хобби Гитара')).map((r) => r.raw_merchant)).toEqual(['струны Ёлка']);
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

describe('read state', () => {
  test('SMS transactions arrive unread, opening marks them read once; manual ones are read', async () => {
    
    const r = await ingestSms({ sender: 'TBC SMS', body: '5.00GEL\n(*XXXX)\nSPAR\n03/10/26 12:00', timestamp: 1 });
    if (r.status !== 'inserted') throw new Error('not inserted');
    await addManualTransaction({ amount_minor: 100, category_id: null });
    expect(await countUnseenTransactions()).toBe(1);
    expect(await markTransactionSeen(r.txId)).toBe(true);
    expect(await markTransactionSeen(r.txId)).toBe(false); // already read: no change
    expect(await countUnseenTransactions()).toBe(0);
  });

  test('a transaction with a category is not unread, even if never opened', async () => {
    const a = await ingestSms({ sender: 'TBC SMS', body: '5.00GEL\n(*XXXX)\nSPAR\n03/10/26 12:00', timestamp: 1 });
    const b = await ingestSms({ sender: 'TBC SMS', body: '6.00GEL\n(*XXXX)\nIKEA\n03/10/26 12:00', timestamp: 2 });
    if (a.status !== 'inserted' || b.status !== 'inserted') throw new Error('not inserted');
    expect(await countUnseenTransactions()).toBe(2);
    await assignCategory(a.txId, 3);           // e.g. chosen from the notification
    expect(await countUnseenTransactions()).toBe(1);
    const rows = (await listTransactionsPage(null)).rows;
    expect(rows.filter(isUnread).map((r) => r.id)).toEqual([b.txId]);
  });

  test('migration 5 marks everything already stored as read', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 4));
    await db.run(`INSERT INTO transactions (bank, kind, amount_minor, currency, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', 1, 'GEL', 1, '', 'x')`);
    await migrate(db);
    expect(await db.get('SELECT count(*) AS n FROM transactions WHERE seen_at IS NULL')).toEqual({ n: 0 });
  });
});

describe('exact filters', () => {
  const day = (d: number, h = 12) => Math.floor(new Date(2026, 9, d, h).getTime() / 1000);
  async function seedFilter() {
    const db = await getDb();
    const rows: Array<[number, number | null, number]> = [[1, 1, day(1)], [2, 1, day(3, 23)], [3, 2, day(4, 0)], [4, null, day(5)]];
    for (const [i, cat, at] of rows) {
      await db.run(`INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, category_id, occurred_at, raw_sms, sms_hash)
        VALUES ('tbc', 'purchase', ?, 'GEL', ?, ?, ?, '', ?)`, [i * 100, `M${i}`, cat, at, `f${i}`]);
    }
  }
  const merchants = (rows: Array<{ raw_merchant: string | null }>) => rows.map((r) => r.raw_merchant);

  test('by category and uncategorized', async () => {
    await seedFilter();
    expect(merchants(await listTransactionsFiltered({ category: 1 }))).toEqual(['M2', 'M1']);
    expect(merchants(await listTransactionsFiltered({ category: 'none' }))).toEqual(['M4']);
  });

  test('by day range: both ends inclusive, local days', async () => {
    await seedFilter();
    const range = rangeToUnix({ from: '2026-10-03', to: '2026-10-04' });
    expect(merchants(await listTransactionsFiltered(range))).toEqual(['M3', 'M2']); // 3rd 23:00 and 4th 00:00
    expect(merchants(await listTransactionsFiltered(rangeToUnix({ from: '2026-10-05', to: '2026-10-05' })))).toEqual(['M4']);
  });

  test('categoriesWithTransactions: counts, deleted ones kept, uncategorized last', async () => {
    await seedFilter();
    await getDb().then((db) => db.run('UPDATE categories SET deleted_at = 1 WHERE id = 2'));
    const opts = await categoriesWithTransactions();
    expect(opts.map((o) => [o.category, o.count, o.deleted])).toEqual([[1, 2, false], [2, 1, true], ['none', 1, false]]);
    expect(opts[2].name).toBe('Без категории');
  });
});
