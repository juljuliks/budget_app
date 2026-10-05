jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { ingestSms } from '../src/ingest';
import { assignCategory, categoryChangeTotals, merchantChangePreview } from '../src/assign';
import {
  categoriesOfMerchants, deleteMerchants, excludeFromGroup, getMerchant, listMerchants, mergeMerchants, renameMerchantGroup, setMerchantCategory,
} from '../src/db/merchants';
import { listTransactionsFiltered, merchantsWithTransactions } from '../src/db/transactions';
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

test('merging: one merchant with one category; new SMS of any member get it; filter and chip show the group', async () => {
  const vake = await sms('SPAR VAKE');
  const sab = await sms('SPAR SABURTALO');
  await sms('WOLT');
  await assignCategory(vake, 1);
  await assignCategory(sab, 2);
  expect(await categoriesOfMerchants(['SPAR VAKE', 'SPAR SABURTALO'])).toEqual(expect.arrayContaining([1, 2]));

  const id = await mergeMerchants(['SPAR VAKE', 'SPAR SABURTALO'], 'SPAR', 2);
  // the members' own categories are gone, their followers follow the group
  expect([await categoryOf(vake), await categoryOf(sab)]).toEqual([2, 2]);
  const rules = await (await getDb()).all('SELECT pattern, category_id FROM merchant_rules ORDER BY pattern');
  expect(rules).toEqual([{ pattern: id, category_id: 2 }]);

  const next = await sms('SPAR VAKE', '1.00');
  expect(await categoryOf(next)).toBe(2);

  const g = (await listMerchants()).find((m) => m.id === id)!;
  expect(g).toEqual(expect.objectContaining({ name: 'SPAR', group: true, count: 3, category_id: 2 }));
  expect(g.members.sort()).toEqual(['SPAR SABURTALO', 'SPAR VAKE']);
  expect((await merchantsWithTransactions()).find((m) => m.merchant === id)).toEqual({ merchant: id, name: 'SPAR', count: 3 });
  expect((await listTransactionsFiltered({ merchant: id })).length).toBe(3);

  // changing a member transaction's category asks about the group
  expect(await merchantChangePreview(next, 1)).toEqual(expect.objectContaining({ merchant: 'SPAR', fromCategoryId: 2, count: 3 }));
  await assignCategory(next, 1, 'merchant');
  expect([await categoryOf(vake), await categoryOf(sab), await categoryOf(next)]).toEqual([1, 1, 1]);
});

test('merging a group with another merchant adds it to the group; two groups become one', async () => {
  await sms('A1'); await sms('A2'); await sms('B1'); await sms('B2'); await sms('C');
  const a = await mergeMerchants(['A1', 'A2'], 'A', null);
  const b = await mergeMerchants(['B1', 'B2'], 'B', 3);
  const merged = await mergeMerchants([a, b, 'C'], 'ABC', 4);
  expect(merged).toBe(a);
  const g = (await getMerchant(merged))!;
  expect(g.memberRows.map((m) => m.key).sort()).toEqual(['A1', 'A2', 'B1', 'B2', 'C']);
  expect((await listMerchants()).map((m) => m.id)).toEqual([merged]);
  expect(await (await getDb()).all('SELECT pattern, category_id FROM merchant_rules')).toEqual([{ pattern: merged, category_id: 4 }]);
});

test('excluding from a group: the merchant keeps the group category as its own; an emptied group is removed', async () => {
  const x = await sms('X1');
  await sms('X2');
  const id = await mergeMerchants(['X1', 'X2'], 'X', 2);
  await renameMerchantGroup(id, 'Икс');
  expect((await getMerchant(id))!.name).toBe('Икс');

  await excludeFromGroup(id, ['X1']);
  expect(await findCategoryForMerchant('X1')).toEqual({ category_id: 2, source: 'rule' });
  expect(await categoryOf(x)).toBe(2);
  expect((await getMerchant(id))!.memberRows.map((m) => m.key)).toEqual(['X2']);

  await excludeFromGroup(id, ['X2']);
  expect(await getMerchant(id)).toBeNull();
  expect((await listMerchants()).map((m) => m.id).sort()).toEqual(['X1', 'X2']);
  expect(await (await getDb()).get("SELECT 1 FROM merchant_rules WHERE pattern = ?", [id])).toBeUndefined();
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

test('deleting merchants: operations keep their categories (as their own), lose the merchant; a group is only ungrouped', async () => {
  const a = await sms('SPAR VAKE');
  const b = await sms('SPAR SABURTALO');
  const w = await sms('WOLT');
  const w2 = await sms('WOLT');
  const keep = await sms('GLOVO');
  await assignCategory(w, 1);          // WOLT -> 1, w2 follows
  await assignCategory(w2, 3, 'only'); // a manual choice
  await assignCategory(keep, 1);
  const group = await mergeMerchants(['SPAR VAKE', 'SPAR SABURTALO'], 'SPAR', 2);
  expect(await deleteMerchants([group, 'WOLT'])).toBe(2);

  const db = await getDb();
  const rows = await db.all<{ merchant_key: string | null; category_id: number | null; category_source: string | null }>(
    'SELECT merchant_key, category_id, category_source FROM transactions WHERE id IN (?, ?, ?, ?) ORDER BY id', [a, b, w, w2]);
  expect(rows).toEqual([
    { merchant_key: 'SPAR VAKE', category_id: 2, category_source: 'rule' },
    { merchant_key: 'SPAR SABURTALO', category_id: 2, category_source: 'rule' },
    { merchant_key: null, category_id: 1, category_source: 'user' },
    { merchant_key: null, category_id: 3, category_source: 'user' },
  ]);
  // the group's merchants are separate ones with its category
  const list = await listMerchants();
  expect(list.map((m) => [m.id, m.category_id]).sort()).toEqual([['GLOVO', 1], ['SPAR SABURTALO', 2], ['SPAR VAKE', 2]]);
  expect(await db.all('SELECT * FROM merchant_groups')).toEqual([]);

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
