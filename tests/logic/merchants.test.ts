jest.mock('../../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { ingestSms } from '../../src/ingest';
import { assignCategory, categoryChangeTotals, merchantChangePreview } from '../../src/assign';
import {
  addMerchantCategory, deleteMerchants, listMerchants, merchantCategories, merchantFollowers, merchantsCategoryPreview, removeMerchantCategory, setMerchantCategory, setMerchantMixed, setMerchantsCategory,
} from '../../src/db/merchants';
import { findCategoryForMerchant } from '../../src/categorize';
import { freshDb } from '../helpers';

let ts = 1;
async function sms(merchant: string, amount = '5.00') {
  const r = await ingestSms({ sender: 'TBC SMS', body: `${amount}GEL\n(*XXXX)\n${merchant}\n03/10/26 12:00`, timestamp: ts++ });
  if (r.status !== 'inserted') throw new Error(`not inserted: ${r.status}`);
  return r.txId;
}
const categoryOf = async (id: number) =>
  (await (await getDb()).get<{ category_id: number | null }>('SELECT category_id FROM transactions WHERE id = ?', [id]))!.category_id;

beforeEach(() => freshDb());

test('the list: merchants of purchases with their category, most frequent first', async () => {
  const a = await sms('SPAR VAKE');
  await sms('SPAR VAKE');
  await sms('WOLT');
  await assignCategory(a, 1);
  const list = await listMerchants();
  expect(list.map((m) => [m.id, m.name, m.count, m.category_id])).toEqual([['SPAR VAKE', 'SPAR VAKE', 2, 1], ['WOLT', 'WOLT', 1, null]]);
});

test('setting / removing a merchant category: followers change, manual choices stay', async () => {
  const a = await sms('SPAR');
  const b = await sms('SPAR');
  await assignCategory(a, 1);          // SPAR -> 1, b follows
  await assignCategory(b, 3, 'only');  // b: a manual choice
  expect((await merchantFollowers('SPAR')).count).toBe(1);
  await setMerchantCategory('SPAR', 2);
  expect([await categoryOf(a), await categoryOf(b)]).toEqual([2, 3]);
  await setMerchantCategory('SPAR', null);
  expect(await findCategoryForMerchant('SPAR')).toBeNull();
  expect([await categoryOf(a), await categoryOf(b)]).toEqual([null, 3]);
  const c = await sms('SPAR');
  expect(await categoryOf(c)).toBeNull(); // arrives without a category again
});

test('changing / removing a merchant category keeping the past: its operations keep theirs, no longer following it', async () => {
  const a = await sms('SPAR');
  await assignCategory(a, 1);
  await setMerchantCategory('SPAR', 2, 'keep');
  expect(await categoryOf(a)).toBe(1);
  expect((await findCategoryForMerchant('SPAR'))?.category_id).toBe(2);
  expect((await merchantFollowers('SPAR')).count).toBe(0);
  expect(await categoryOf(await sms('SPAR'))).toBe(2);
  await setMerchantCategory('SPAR', null, 'keep');
  expect(await categoryOf(a)).toBe(1);
});

test('one category for several merchants: their followers change, manual choices stay; the preview counts what changes', async () => {
  const vake = await sms('SPAR VAKE', '10.00');
  const sab = await sms('SPAR SABURTALO', '4.00');
  const own = await sms('SPAR SABURTALO', '2.00');
  await sms('WOLT');
  await assignCategory(own, 3, 'only'); // a manual choice
  expect(await merchantsCategoryPreview(['SPAR VAKE', 'SPAR SABURTALO'], 2))
    .toEqual({ count: 2, totals: [{ currency: 'GEL', amount_minor: 1400 }] });

  await setMerchantsCategory(['SPAR VAKE', 'SPAR SABURTALO'], 2);
  expect([await categoryOf(vake), await categoryOf(sab), await categoryOf(own)]).toEqual([2, 2, 3]);
  expect(await findCategoryForMerchant('SPAR VAKE')).toEqual({ category_id: 2, source: 'rule' });
  expect(await categoryOf(await sms('SPAR SABURTALO', '1.00'))).toBe(2);
  expect((await listMerchants()).map((m) => [m.id, m.category_id]).sort()).toEqual([['SPAR SABURTALO', 2], ['SPAR VAKE', 2], ['WOLT', null]]);
});

test('category change totals: refunds subtract, ordered by the signed sum', async () => {
  await sms('SPAR', '10.00');
  const usd = async (amount: string) => {
    const r = await ingestSms({ sender: 'TBC SMS', body: `${amount}USD\n(*XXXX)\nSPAR\n03/10/26 12:00`, timestamp: ts++ });
    if (r.status !== 'inserted') throw new Error(`not inserted: ${r.status}`);
    return r.txId;
  };
  await usd('5.00');
  const refund = await usd('100.00');
  await (await getDb()).run("UPDATE transactions SET kind = 'refund' WHERE id = ?", [refund]);
  expect(await categoryChangeTotals('SPAR', 1)).toEqual([
    { currency: 'GEL', amount_minor: 1000, n: 1 },
    { currency: 'USD', amount_minor: -9500, n: 2 },
  ]);
});

/** "dd/mm/yy 12:00" `days` days ago */
const daysAgo = (days: number) => {
  const d = new Date(Date.now() - days * 86400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)} 12:00`;
};
async function smsOn(merchant: string, amount: string, days: number) {
  const r = await ingestSms({ sender: 'TBC SMS', body: `${amount}GEL\n(*XXXX)\n${merchant}\n${daysAgo(days)}`, timestamp: ts++ });
  if (r.status !== 'inserted') throw new Error(`not inserted: ${r.status}`);
  return r.txId;
}

test('activity: the last month if anything was bought then, otherwise everything with its dates', async () => {
  await smsOn('SPAR', '10.00', 2);
  await smsOn('SPAR', '5.50', 10);
  await smsOn('SPAR', '100.00', 60); // older: not in the last month
  await smsOn('WOLT', '7.00', 90);
  await smsOn('WOLT', '3.00', 45);
  const byId = new Map((await listMerchants()).map((m) => [m.id, m.activity]));
  expect(byId.get('SPAR')).toEqual(expect.objectContaining({ recent: true, count: 2, totals: [{ currency: 'GEL', amount_minor: 1550 }] }));
  const wolt = byId.get('WOLT')!;
  expect(wolt).toEqual(expect.objectContaining({ recent: false, count: 2, totals: [{ currency: 'GEL', amount_minor: 1000 }] }));
  expect(wolt.to - wolt.from).toBeGreaterThan(40 * 86400);
});

test('deleting merchants: operations keep their categories (as their own), lose the merchant', async () => {
  const w = await sms('WOLT');
  const w2 = await sms('WOLT');
  const keep = await sms('GLOVO');
  await assignCategory(w, 1);          // WOLT -> 1, w2 follows
  await assignCategory(w2, 3, 'only'); // a manual choice
  await assignCategory(keep, 1);
  expect(await deleteMerchants(['WOLT'])).toBe(2);

  const db = await getDb();
  const rows = await db.all<{ merchant_key: string | null; category_id: number | null; category_source: string | null }>(
    'SELECT merchant_key, category_id, category_source FROM transactions WHERE id IN (?, ?) ORDER BY id', [w, w2]);
  expect(rows).toEqual([
    { merchant_key: null, category_id: 1, category_source: 'user' },
    { merchant_key: null, category_id: 3, category_source: 'user' },
  ]);
  expect((await listMerchants()).map((m) => [m.id, m.category_id])).toEqual([['GLOVO', 1]]);

  // a new SMS of a deleted shop creates it again, without a category
  const again = await sms('WOLT');
  expect(await categoryOf(again)).toBeNull();
});

test('a merchant without a category: nothing asked, the pick becomes its category; with one, the question', async () => {
  const a = await sms('BOLT');
  const b = await sms('BOLT');
  expect(await merchantChangePreview(a, 1)).toBeNull();
  await assignCategory(a, 1);
  expect(await findCategoryForMerchant('BOLT')).toEqual({ category_id: 1, source: 'rule' });
  expect(await categoryOf(b)).toBe(1);
  expect(await merchantChangePreview(b, 2)).toEqual(expect.objectContaining({ merchant: 'BOLT', fromCategoryId: 1, count: 2 }));
});

describe('bulk category change: the selected operations only, or their merchants too', () => {
  test('"и для мерчантов": both merchants get the rule, their other followers move, manual choices stay', async () => {
    const { assignCategoryToMany, merchantsChangePreview } = await import('../../src/assign');
    const a = await sms('SPAR');
    const b = await sms('SPAR');
    const c = await sms('WOLT');
    const manual = await sms('SPAR');
    await assignCategory(a, 1, 'merchant');
    await assignCategory(c, 1, 'merchant');
    await assignCategory(manual, 3, 'only');
    const preview = await merchantsChangePreview([a, c], 2);
    expect(preview?.merchants.sort()).toEqual(['SPAR', 'WOLT']);
    // a, b and c follow (manual stays)
    expect(preview?.count).toBe(3);
    expect(await assignCategoryToMany([a, c], 2, 'merchant')).toBe(2);
    expect([await categoryOf(a), await categoryOf(b), await categoryOf(c), await categoryOf(manual)]).toEqual([2, 2, 2, 3]);
    expect((await findCategoryForMerchant('SPAR'))?.category_id).toBe(2);
    expect((await findCategoryForMerchant('WOLT'))?.category_id).toBe(2);
    // already their category: nothing to ask
    expect(await merchantsChangePreview([a, c], 2)).toBeNull();
  });

  test('"только для выбранных": no rules, the others stay', async () => {
    const { assignCategoryToMany } = await import('../../src/assign');
    const a = await sms('SPAR');
    const b = await sms('SPAR');
    expect(await assignCategoryToMany([a], 2, 'only')).toBe(0);
    expect([await categoryOf(a), await categoryOf(b)]).toEqual([2, null]);
    expect(await findCategoryForMerchant('SPAR')).toBeNull();
  });

  test('nothing asked: a merchant without a category gets it, one with another keeps its own', async () => {
    const { assignCategoryToMany } = await import('../../src/assign');
    const a = await sms('SPAR');
    const b = await sms('SPAR');
    const c = await sms('WOLT');
    await assignCategory(c, 1);
    expect(await assignCategoryToMany([a, c], 2)).toBe(1);
    expect([await categoryOf(a), await categoryOf(b), await categoryOf(c)]).toEqual([2, 2, 2]);
    expect((await findCategoryForMerchant('SPAR'))?.category_id).toBe(2);
    expect((await findCategoryForMerchant('WOLT'))?.category_id).toBe(1);
  });

  test('no merchant to ask about: "Без категории" or no merchants', async () => {
    const { merchantsChangePreview } = await import('../../src/assign');
    const a = await sms('SPAR');
    expect(await merchantsChangePreview([a], null)).toBeNull();
    expect(await merchantsChangePreview([], 2)).toBeNull();
  });
});

describe('a merchant of different categories', () => {
  test('has no category of its own: new operations arrive without one, picks stay theirs, no question asked', async () => {
    const first = await sms('WOLT');
    await assignCategory(first, 1); // the first pick became the merchant's
    const followed = await sms('WOLT');
    expect(await categoryOf(followed)).toBe(1);

    await setMerchantMixed('WOLT', true);
    expect(await findCategoryForMerchant('WOLT')).toBeNull();
    // what followed the merchant keeps its category, as its own
    expect(await (await getDb()).get('SELECT category_id, category_source FROM transactions WHERE id = ?', [followed])).toEqual({ category_id: 1, category_source: 'user' });

    const next = await sms('WOLT');
    expect(await categoryOf(next)).toBeNull();
    expect(await merchantChangePreview(next, 2)).toBeNull();
    await assignCategory(next, 2);
    expect(await findCategoryForMerchant('WOLT')).toBeNull();
    expect(await categoryOf(next)).toBe(2);

    const list = await listMerchants();
    expect(list.find((m) => m.id === 'WOLT')).toEqual(expect.objectContaining({ mixed: true, category_id: null }));
    // the categories its operations had, the most used first
    expect((await merchantCategories('WOLT')).map((c) => [c.id, c.n])).toEqual([[1, 2], [2, 1]]);
  });

  test('picking one category for it ends the "different" mark', async () => {
    await sms('WOLT');
    await setMerchantMixed('WOLT', true);
    await setMerchantCategory('WOLT', 3);
    expect(await findCategoryForMerchant('WOLT')).toEqual({ category_id: 3, source: 'rule' });
    expect((await listMerchants())[0].mixed).toBe(false);
  });

  test('its list: what its operations had when marked, added by hand or by a pick, removed by hand', async () => {
    const op = await sms('WOLT');
    await setMerchantMixed('WOLT', true);
    expect(await merchantCategories('WOLT')).toEqual([]);
    await addMerchantCategory('WOLT', 1);
    await addMerchantCategory('WOLT', 2);
    expect((await merchantCategories('WOLT')).map((c) => [c.id, c.n])).toEqual([[1, 0], [2, 0]]);
    await assignCategory(op, 2);
    expect((await merchantCategories('WOLT')).map((c) => [c.id, c.n])).toEqual([[2, 1], [1, 0]]);
    await removeMerchantCategory('WOLT', 1);
    await assignCategory(await sms('WOLT'), 3);
    expect((await merchantCategories('WOLT')).map((c) => c.id)).toEqual([2, 3]);
  });
});
