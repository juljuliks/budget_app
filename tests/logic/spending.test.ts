// One rule of what counts as spending (src/db/spending.ts): a category's total, a merchant's total and the month's
// stats count the same operations the same way.
import { getDb } from '../../src/db';
import { categorySummary, createCategory } from '../../src/db/categories';
import { getMerchant } from '../../src/db/merchants';
import { currentYm, monthStats, parseYm } from '../../src/db/plans';
import { freshDb } from '../helpers';

let seq = 0;
const at = Math.floor(Date.now() / 1000) - 60;

async function add(kind: string, amount: number, categoryId: number | null, merchant: string | null, settled = false) {
  const db = await getDb();
  await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash, refund_settled_at)
      VALUES ('tbc', ?, ?, 'GEL', ?, ?, ?, 'user', ?, '', ?, ?)`,
    [kind, amount, merchant, merchant, categoryId, at, `s${seq++}`, settled ? at : null]);
}

beforeEach(() => freshDb());

test('purchases and payments count, refunds and deposits in the category subtract, a settled refund doesn\'t count', async () => {
  const cat = await createCategory('Одежда', '👕', null, null);
  await add('purchase', 10000, cat, 'ZARA');
  await add('payment', 2000, cat, 'ZARA');
  await add('refund', 3000, cat, 'ZARA');
  // settled on its purchase earlier: the purchase already shows it
  await add('refund', 5000, cat, 'ZARA', true);
  // money back from a person, put in this category
  await add('deposit', 1000, cat, null);
  await add('transfer', 4000, cat, null);

  // the category: 100 + 20 − 30 − 10 + 40
  expect((await categorySummary(cat)).totals).toEqual([{ currency: 'GEL', amount_minor: 12000 }]);
  // the merchant: its purchases and payments minus its refund (transfers and deposits aren't the merchant's)
  expect((await getMerchant('ZARA'))!.totals).toEqual([{ currency: 'GEL', amount_minor: 9000 }]);
  // the month's stats: the same as the category's
  const { year, month } = parseYm(currentYm());
  const stats = await monthStats(year, month);
  expect(stats.categories.find((c) => c.category_id === cat)?.spent_minor).toBe(12000);
});
