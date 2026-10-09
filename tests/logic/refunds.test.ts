jest.mock('../../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { monthStats } from '../../src/db/plans';
import { freshDb } from '../helpers';

const DAY = 86400;
const NOW = Math.floor(new Date(2026, 9, 3, 12).getTime() / 1000);
let seq = 0;

async function add(kind: string, amount: number, merchantKey: string | null, occurredAt: number, categoryId: number | null = null) {
  const db = await getDb();
  const { lastInsertRowid } = await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', ?, ?, 'GEL', ?, ?, ?, ?, ?, '', ?)`,
    [kind, amount, merchantKey, merchantKey, categoryId, categoryId ? 'user' : null, occurredAt, `h${seq++}`]);
  return lastInsertRowid;
}

beforeEach(() => freshDb());

test('a refund without a category is subtracted from the total as "Возвраты без категории", not from a category', async () => {
  const now = new Date();
  const at = Math.floor(now.getTime() / 1000);
  await add('purchase', 12000, 'TEMU COM', at, 1);
  await add('refund', 9478, 'TEMU COM', at);
  const s = await monthStats(now.getFullYear(), now.getMonth());
  expect(s.refunds_unassigned_minor).toBe(9478);
  expect(s.spent_minor).toBe(12000 - 9478);
  expect(s.categories.map((c) => [c.category_id, c.spent_minor])).toEqual([[1, 12000]]);
});

test('a refund with a category is subtracted from it; settled on its purchase it no longer counts', async () => {
  const now = new Date();
  const at = Math.floor(now.getTime() / 1000);
  const purchase = await add('purchase', 12000, 'TEMU COM', at - 60, 1);
  const refund = await add('refund', 2000, 'TEMU COM', at, 1);
  let s = await monthStats(now.getFullYear(), now.getMonth());
  expect(s.categories.map((c) => [c.category_id, c.spent_minor])).toEqual([[1, 10000]]);
  // settled earlier on its purchase (the purchase was reduced): the refund doesn't count twice
  const db = await getDb();
  await db.run('UPDATE transactions SET amount_minor = amount_minor - 2000 WHERE id = ?', [purchase]);
  await db.run('UPDATE transactions SET refund_settled_at = 1, refund_target_id = ? WHERE id = ?', [purchase, refund]);
  s = await monthStats(now.getFullYear(), now.getMonth());
  expect(s.categories.map((c) => [c.category_id, c.spent_minor])).toEqual([[1, 10000]]);
  expect(s.refunds_unassigned_minor).toBe(0);
});

test('period stats and per-transaction spending: expenses count, deposits don\'t, refunds subtract', async () => {
  const { periodStats, spendingEntries } = require('../../src/db/plans');
  await add('purchase', 1000, 'SPAR', NOW, 1);
  await add('purchase', 500, 'WOLT', NOW, 2);
  await add('deposit', 9999, 'ANNA', NOW);
  await add('refund', 300, 'SPAR', NOW);         // no category: from the total
  await add('purchase', 700, 'SPAR', NOW - 2 * DAY, 1); // another day
  const s = await periodStats(NOW - 3600, NOW + 3600);
  expect(s.spent_minor).toBe(1200);
  expect(s.refunds_unassigned_minor).toBe(300);
  expect(s.categories.map((c: { category_id: number }) => c.category_id)).toEqual([1, 2]);
  const e = await spendingEntries(NOW - 3 * DAY, NOW + DAY);
  expect(e.map((x: { spent_minor: number }) => x.spent_minor).sort((a: number, b: number) => a - b)).toEqual([-300, 500, 700, 1000]);
});

test('refundCategory: the merchant\'s category, else its latest purchase\'s, else none', async () => {
  const { refundCategory } = require('../../src/db/refunds');
  const db = await getDb();
  await db.run("INSERT INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES ('exact', 'WOLT', 5, 0)");
  expect(await refundCategory('WOLT', NOW)).toBe(5);
  await add('purchase', 100, 'TEMU COM', NOW - 10 * DAY, 3);
  await add('purchase', 100, 'TEMU COM', NOW - 3 * DAY, 4);
  expect(await refundCategory('TEMU COM', NOW)).toBe(4);
  expect(await refundCategory('UNKNOWN', NOW)).toBeNull();
  expect(await refundCategory(null, NOW)).toBeNull();
});

test('autoCategorizeRefunds: old refunds get their merchant\'s category; settled or user-cleared ones are left', async () => {
  const { autoCategorizeRefunds } = require('../../src/db/refunds');
  await add('purchase', 1000, 'TEMU COM', NOW - DAY, 4);
  const open = await add('refund', 300, 'TEMU COM', NOW);
  const settled = await add('refund', 200, 'TEMU COM', NOW);
  const db = await getDb();
  await db.run('UPDATE transactions SET refund_settled_at = 1 WHERE id = ?', [settled]);
  const cleared = await add('refund', 100, 'TEMU COM', NOW);
  await db.run("UPDATE transactions SET category_source = 'user' WHERE id = ?", [cleared]);
  expect(await autoCategorizeRefunds()).toBe(1);
  const cat = async (id: number) => (await db.get<{ category_id: number | null }>('SELECT category_id FROM transactions WHERE id = ?', [id]))!.category_id;
  expect([await cat(open), await cat(settled), await cat(cleared)]).toEqual([4, null, null]);
});

test('setting a merchant\'s category also gives it to its open refunds (settled ones and manual choices stay)', async () => {
  const { setMerchantCategory } = require('../../src/db/merchants');
  const open = await add('refund', 300, 'TEMU COM', NOW);
  const settled = await add('refund', 200, 'TEMU COM', NOW);
  const db = await getDb();
  await db.run('UPDATE transactions SET refund_settled_at = 1 WHERE id = ?', [settled]);
  const manual = await add('refund', 100, 'TEMU COM', NOW, 9); // the user's own choice ('user')
  await setMerchantCategory('TEMU COM', 4);
  const cat = async (id: number) => (await db.get<{ category_id: number | null }>('SELECT category_id FROM transactions WHERE id = ?', [id]))!.category_id;
  expect([await cat(open), await cat(settled), await cat(manual)]).toEqual([4, null, 9]);
});
