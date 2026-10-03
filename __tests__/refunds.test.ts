jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { deletePurchaseByRefund, getRefund, reducePurchaseByRefund, refundCandidates } from '../src/db/refunds';
import { monthStats } from '../src/db/plans';
import { freshDb } from './helpers';

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

test('candidates: same merchant, last 90 days, same amount first, then newest', async () => {
  const refund = await add('refund', 9478, 'TEMU COM', NOW);
  const older = await add('purchase', 2000, 'TEMU COM', NOW - 30 * DAY);
  const newer = await add('purchase', 5000, 'TEMU COM', NOW - 5 * DAY);
  const same = await add('purchase', 9478, 'TEMU COM', NOW - 60 * DAY);
  await add('purchase', 9478, 'TEMU COM', NOW - 100 * DAY); // too old
  await add('purchase', 9478, 'WOLT', NOW - DAY); // other merchant
  await add('transfer', 9478, 'TEMU COM', NOW - DAY); // not a purchase

  const c = await refundCandidates(refund);
  expect(c.map((x) => x.id)).toEqual([same, newer, older]);
  expect(c[0].same_amount).toBe(true);
});

test('reduce: the purchase gets cheaper, the refund is settled and seen', async () => {
  const purchase = await add('purchase', 12000, 'TEMU COM', NOW - DAY, 1);
  const refund = await add('refund', 9478, 'TEMU COM', NOW);
  await reducePurchaseByRefund(refund, purchase);
  const db = await getDb();
  expect(await db.get('SELECT amount_minor FROM transactions WHERE id = ?', [purchase])).toEqual({ amount_minor: 2522 });
  expect(await getRefund(refund)).toEqual(expect.objectContaining({ refund_target_id: purchase, refund_settled_at: expect.any(Number) }));
  expect((await db.get<{ seen_at: number | null }>('SELECT seen_at FROM transactions WHERE id = ?', [refund]))!.seen_at).not.toBeNull();
});

test('reduce is refused when the refund covers the whole purchase', async () => {
  const purchase = await add('purchase', 9478, 'TEMU COM', NOW - DAY);
  const refund = await add('refund', 9478, 'TEMU COM', NOW);
  await expect(reducePurchaseByRefund(refund, purchase)).rejects.toHaveProperty('message', 'refund covers the whole purchase');
  expect((await getRefund(refund))!.refund_settled_at).toBeNull();
});

test('delete: the purchase disappears, the refund is settled', async () => {
  const purchase = await add('purchase', 9478, 'TEMU COM', NOW - DAY);
  const refund = await add('refund', 9478, 'TEMU COM', NOW);
  await deletePurchaseByRefund(refund, purchase);
  const db = await getDb();
  expect(await db.get('SELECT 1 FROM transactions WHERE id = ?', [purchase])).toBeUndefined();
  expect((await getRefund(refund))!.refund_target_id).toBe(purchase);
});

test('an uncategorized refund does not count in stats (it is settled on the purchase instead)', async () => {
  const now = new Date();
  const at = Math.floor(now.getTime() / 1000);
  await add('purchase', 12000, 'TEMU COM', at, 1);
  await add('refund', 9478, 'TEMU COM', at);
  const s = await monthStats(now.getFullYear(), now.getMonth());
  expect(s.spent_minor).toBe(12000);
  expect(s.categories.map((c) => c.category_id)).toEqual([1]);
});
