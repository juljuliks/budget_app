import { getDb } from '../../src/db';
import { getMerchant } from '../../src/db/merchants';
import { categorySummary } from '../../src/db/categories';
import { freshDb } from '../helpers';

let seq = 0;
async function add(kind: string, amount: number, merchantKey: string, categoryId: number | null, settled = false) {
  const db = await getDb();
  await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, occurred_at, raw_sms, sms_hash, refund_settled_at)
      VALUES ('tbc', ?, ?, 'GEL', ?, ?, ?, 1, '', ?, ?)`,
    [kind, amount, merchantKey, merchantKey, categoryId, `s${seq++}`, settled ? 1 : null]);
}

beforeEach(() => freshDb());

test('a merchant\'s total subtracts refunds not settled on a purchase; settled ones are already in the purchase', async () => {
  await add('purchase', 10000, 'TEMU COM', 1);
  await add('purchase', 2000, 'TEMU COM', 1);
  await add('refund', 3000, 'TEMU COM', 1);        // open: subtracted
  await add('refund', 500, 'TEMU COM', 1, true);   // settled: the purchase was already reduced
  const m = await getMerchant('TEMU COM');
  expect(m!.totals).toEqual([{ currency: 'GEL', amount_minor: 9000 }]);
  expect(m!.count).toBe(2);
});

test('a category\'s summary: all its operations counted, spending minus open refunds, deposits aside', async () => {
  await add('purchase', 10000, 'SPAR', 7);
  await add('transfer', 2000, 'ANNA', 7);
  await add('deposit', 5000, 'BOB', 7);
  await add('refund', 1500, 'SPAR', 7);
  await add('refund', 400, 'SPAR', 7, true);
  await add('purchase', 999, 'SPAR', 8);
  expect(await categorySummary(7)).toEqual({ count: 5, totals: [{ currency: 'GEL', amount_minor: 10500 }] });
});

test('money back from a person (a deposit in a transfer category) is subtracted from the transfers to them', async () => {
  const { monthStats } = await import('../../src/db/plans');
  const { getTransferTypeId } = await import('../../src/db/categoryTypes');
  const db = await getDb();
  const dema = (await db.run('INSERT INTO categories (name, type_id) VALUES (?, ?)', ['Дема', await getTransferTypeId()])).lastInsertRowid;
  const food = 1;
  let h = 0;
  const add = (kind: string, amount: number, category: number | null) => db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', ?, ?, 'GEL', ?, 'user', ?, '', ?)`, [kind, amount, category, Math.floor(new Date(2026, 9, 5, 12).getTime() / 1000), `d${h++}`]);
  await add('transfer', 10000, dema);
  await add('transfer', 3800, dema);
  await add('deposit', 10000, dema);
  // a deposit elsewhere (a salary, one in an ordinary category) is income, not counted
  await add('deposit', 500000, null);
  await add('deposit', 2000, food);
  await add('purchase', 5000, food);
  const stats = await monthStats(2026, 9, 'GEL');
  const spent = (id: number) => stats.categories.find((c) => c.category_id === id)?.spent_minor;
  expect(spent(dema)).toBe(3800);
  expect(spent(food)).toBe(5000);
  expect(stats.spent_minor).toBe(8800);
});
