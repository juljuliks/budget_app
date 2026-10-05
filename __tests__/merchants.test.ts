jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { ingestSms } from '../src/ingest';
import { assignCategory, categoryChangeTotals, merchantChangePreview } from '../src/assign';
import {
  deleteMerchants, listMerchants, merchantsCategoryPreview, setMerchantCategory, setMerchantsCategory,
} from '../src/db/merchants';
import { findCategoryForMerchant } from '../src/categorize';
import { freshDb } from './helpers';

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

test('setting / removing a merchant category: followers change, manual choices stay; removing changes nothing', async () => {
  const a = await sms('SPAR');
  const b = await sms('SPAR');
  await assignCategory(a, 1);          // SPAR -> 1, b follows
  await assignCategory(b, 3, 'only');  // b: a manual choice
  await setMerchantCategory('SPAR', 2);
  expect([await categoryOf(a), await categoryOf(b)]).toEqual([2, 3]);
  await setMerchantCategory('SPAR', null);
  expect(await findCategoryForMerchant('SPAR')).toBeNull();
  expect([await categoryOf(a), await categoryOf(b)]).toEqual([2, 3]);
  const c = await sms('SPAR');
  expect(await categoryOf(c)).toBeNull(); // arrives without a category again
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

test('a merchant without a category: picking one asks "this operation or the merchant"', async () => {
  const a = await sms('BOLT');
  const b = await sms('BOLT');
  await assignCategory(a, 2, 'only');
  expect(await merchantChangePreview(b, 1)).toEqual(expect.objectContaining({ merchant: 'BOLT', fromCategoryId: null, count: 1 }));
  await assignCategory(b, 1, 'only');
  expect(await findCategoryForMerchant('BOLT')).toBeNull();
});
