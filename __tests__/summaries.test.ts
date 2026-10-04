import { getDb } from '../src/db';
import { getMerchant } from '../src/db/merchants';
import { categorySummary } from '../src/db/categories';
import { freshDb } from './helpers';

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
