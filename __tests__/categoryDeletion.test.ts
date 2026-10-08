jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { ingestSms } from '../src/ingest';
import { assignCategory, assignCategoryToMany } from '../src/assign';
import { createCategory, deleteCategory } from '../src/db/categories';
import { categoryDeletePreview, currentIdsOfCategory, remainingInCategory, sortOutSummary } from '../src/db/categoryDeletion';
import { setMerchantCategory } from '../src/db/merchants';
import { currentYm, setPlanAmount } from '../src/db/plans';
import { deleteTransaction } from '../src/db/transactions';
import { findCategoryForMerchant } from '../src/categorize';
import {
  deleteEmptyText, deleteStartText, moveAllText, sortOutBanner, sortOutDoneText, sortOutLeaveText, sortOutMerchantText,
} from '../src/ui/categoryDeletionText';
import { freshDb } from './helpers';

// this month (a few days ago, the 1st at the earliest) and two months back
const now = new Date();
const thisMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1, 12).getTime() / 1000);
const pastMonth = Math.floor(new Date(now.getFullYear(), now.getMonth() - 2, 10, 12).getTime() / 1000);

let ts = 1;
/** a purchase at `merchant` on `at` (amount in ₾) */
async function buy(merchant: string, amount: number, at: number) {
  const r = await ingestSms({ sender: 'TBC SMS', body: `${amount.toFixed(2)}GEL\n(*XXXX)\n${merchant}\n03/10/26 12:00`, timestamp: ts++ });
  if (r.status !== 'inserted') throw new Error(`not inserted: ${r.status}`);
  await (await getDb()).run('UPDATE transactions SET occurred_at = ? WHERE id = ?', [at + ts, r.txId]);
  return r.txId;
}
const row = async (id: number) =>
  (await (await getDb()).get<{ category_id: number | null; category_source: string | null }>('SELECT category_id, category_source FROM transactions WHERE id = ?', [id]))!;
const ruleOf = async (key: string) => (await findCategoryForMerchant(key))?.category_id ?? null;
const isDeleted = async (id: number) =>
  !!(await (await getDb()).get<{ deleted_at: number | null }>('SELECT deleted_at FROM categories WHERE id = ?', [id]))?.deleted_at;

let shop: number, clothes: number, tech: number;
// "Покупки": Zara (2 this month, 1 in the past), H&M (1 this month), Wolt (1 this month, hand-picked), Apple (past only)
let zaraNow1: number, zaraNow2: number, zaraPast: number, hmNow: number, woltNow: number, applePast: number;

beforeEach(async () => {
  await freshDb();
  shop = await createCategory('Покупки', '🛍️', null);
  clothes = await createCategory('Одежда', '👕', null);
  tech = await createCategory('Техника', '💻', null);
  zaraPast = await buy('ZARA', 100, pastMonth);
  applePast = await buy('APPLE', 900, pastMonth);
  zaraNow1 = await buy('ZARA', 200, thisMonth);
  zaraNow2 = await buy('ZARA', 50, thisMonth);
  hmNow = await buy('HM', 80, thisMonth);
  woltNow = await buy('WOLT', 30, thisMonth);
  await assignCategory(zaraPast, shop);   // ZARA → Покупки, its operations follow
  await assignCategory(applePast, shop);  // APPLE → Покупки
  await assignCategory(hmNow, shop);      // HM → Покупки
  await assignCategory(woltNow, shop, 'only');
  await setPlanAmount(currentYm(), shop, 50000);
});

describe('the preview', () => {
  it('this month to move, the past kept, its merchants and plan', async () => {
    const p = await categoryDeletePreview(shop);
    expect(p.current).toEqual({ n: 4, totals: [{ currency: 'GEL', amount_minor: 36000 }] });
    expect(p.past).toEqual({ n: 2, totals: [{ currency: 'GEL', amount_minor: 100000 }] });
    expect(p.merchants).toEqual(['ZARA', 'APPLE', 'HM']);
    expect(p.hasPlan).toBe(true);
  });
});

describe('everything to one category (path A)', () => {
  it("moves this month's, keeps the past in it fixed, moves its merchants", async () => {
    await deleteCategory(shop, clothes);
    for (const id of [zaraNow1, zaraNow2, hmNow, woltNow]) expect((await row(id)).category_id).toBe(clothes);
    expect(await row(zaraPast)).toEqual({ category_id: shop, category_source: 'user' });
    expect(await row(applePast)).toEqual({ category_id: shop, category_source: 'user' });
    expect(await ruleOf('ZARA')).toBe(clothes);
    expect(await ruleOf('APPLE')).toBe(clothes);
    expect(await isDeleted(shop)).toBe(true);
  });

  it("a merchant moved later doesn't take the past along", async () => {
    await deleteCategory(shop, clothes);
    await setMerchantCategory('ZARA', tech, 'change');
    expect((await row(zaraPast)).category_id).toBe(shop);
    expect((await row(zaraNow1)).category_id).toBe(tech);
  });

  it('to none: the merchants lose it, the past stays', async () => {
    await deleteCategory(shop, null);
    expect((await row(zaraNow1)).category_id).toBeNull();
    expect((await row(zaraPast)).category_id).toBe(shop);
    expect(await ruleOf('ZARA')).toBeNull();
  });
});

describe('sorting out to several (path B)', () => {
  it('"и для мерчантов" moves the merchant and this month only', async () => {
    await assignCategoryToMany([zaraNow1, zaraNow2], clothes, 'merchant', shop);
    expect((await row(zaraNow1)).category_id).toBe(clothes);
    expect(await row(zaraPast)).toEqual({ category_id: shop, category_source: 'user' });
    expect(await ruleOf('ZARA')).toBe(clothes);
    // the other merchants' past is untouched until the category goes
    expect(await row(applePast)).toEqual({ category_id: shop, category_source: 'rule' });
  });

  it('"только для выбранных" leaves the merchant on it', async () => {
    await assignCategoryToMany([hmNow], tech, 'only', shop);
    expect((await row(hmNow)).category_id).toBe(tech);
    expect(await ruleOf('HM')).toBe(shop);
  });

  it('counts what is left, and tells where everything went', async () => {
    const ids = await currentIdsOfCategory(shop);
    expect(ids.sort()).toEqual([zaraNow1, zaraNow2, hmNow, woltNow].sort());
    await assignCategoryToMany([zaraNow1, zaraNow2], clothes, 'merchant', shop);
    expect(await remainingInCategory(shop)).toEqual({ n: 2, totals: [{ currency: 'GEL', amount_minor: 11000 }] });
    await assignCategoryToMany([hmNow], tech, 'only', shop);
    await assignCategoryToMany([woltNow], null, 'only', shop);
    expect((await remainingInCategory(shop)).n).toBe(0);

    const s = await sortOutSummary(shop, ids);
    expect(s.moved.map((m) => [m.name, m.n, m.totals])).toEqual([
      ['Одежда', 2, [{ currency: 'GEL', amount_minor: 25000 }]],
      ['Техника', 1, [{ currency: 'GEL', amount_minor: 8000 }]],
      [null, 1, [{ currency: 'GEL', amount_minor: 3000 }]],
    ]);
    expect(s.deleted.n).toBe(0);

    // what deleting then says: HM and APPLE still have it; the past stays
    const p = await categoryDeletePreview(shop);
    expect(p.current.n).toBe(0);
    expect(p.merchants).toEqual(['APPLE', 'HM']);
    await deleteCategory(shop, null);
    expect(await row(applePast)).toEqual({ category_id: shop, category_source: 'user' });
    expect(await ruleOf('HM')).toBeNull();
  });

  it('an operation deleted meanwhile is counted apart', async () => {
    const ids = await currentIdsOfCategory(shop);
    await deleteTransaction(woltNow);
    await assignCategoryToMany([zaraNow1, zaraNow2, hmNow], clothes, 'only', shop);
    const s = await sortOutSummary(shop, ids);
    expect(s.moved.map((m) => m.n)).toEqual([3]);
    expect(s.deleted.n).toBe(1);
  });
});

describe('the texts', () => {
  const bucket = (n: number, lari: number) => ({ n, totals: [{ currency: 'GEL', amount_minor: lari * 100 }] });
  const preview = { current: bucket(12, 840), past: bucket(34, 2300), merchants: ['Zara', 'H&M', 'Bershka', 'Mango', 'COS'], hasPlan: true };

  it('no operations this month: past, merchants, plan', () => {
    const t = deleteEmptyText('Покупки', { ...preview, current: { n: 0, totals: [] } });
    expect(t.title).toBe('Удалить категорию «Покупки»?');
    expect(t.message).toMatch(/^В этом месяце операций в ней нет\. 34 операции на 2[^₾]*₾ прошлых месяцев останутся в «Покупки» — история и отчёты не изменятся\. 5 мерчантов \(Zara, H&M и ещё 3\) останутся без категории\. План «Покупки» на этот месяц удалится\.$/);
    expect(deleteEmptyText('Покупки', { current: { n: 0, totals: [] }, past: { n: 0, totals: [] }, merchants: [], hasPlan: false }).message)
      .toBe('В этом месяце операций в ней нет.');
  });

  it('the sheet with operations', () => {
    expect(deleteStartText(preview, 'Покупки')).toMatch(/^В этом месяце в «Покупки» 12 операций на 840[^₾]*₾\. Перед удалением их нужно перенести — в одну категорию или разложить по нескольким\.$/);
    expect(deleteStartText({ ...preview, current: { ...preview.current, n: 1 } }, 'Покупки')).toMatch(/^В этом месяце в «Покупки» 1 операция на 840[^₾]*₾\. Перед удалением её нужно перенести в другую категорию\.$/);
  });

  it('everything to one category', () => {
    const t = moveAllText('Покупки', '👕 Одежда', preview);
    expect(t.title).toBe('Перенести в «👕 Одежда» и удалить «Покупки»?');
    const lines = t.message.split('\n');
    expect(lines[0]).toMatch(/^• 12 операций на 840[^₾]*₾ этого месяца перейдут в «👕 Одежда»\.$/);
    expect(lines[1]).toMatch(/^• 34 операции на .* прошлых месяцев останутся в «Покупки» — история и отчёты не изменятся\.$/);
    expect(lines[2]).toBe('• 5 мерчантов (Zara, H&M и ещё 3) получат категорию «👕 Одежда» — их новые операции будут попадать туда.');
    expect(lines[3]).toBe('• План «Покупки» на этот месяц удалится.');
    const none = moveAllText('Покупки', null, { ...preview, past: { n: 0, totals: [] }, merchants: ['Zara'], hasPlan: false });
    expect(none.title).toBe('Удалить «Покупки»?');
    expect(none.message.split('\n')).toEqual([
      expect.stringMatching(/^• 12 операций на .* этого месяца останутся без категории\.$/),
      '• Мерчант Zara останется без категории — его новые операции придётся размечать вручную.',
    ]);
  });

  it('the banner and the questions', () => {
    expect(sortOutBanner('Покупки', bucket(7, 520))).toMatch(/^Удаление «Покупки»: осталось 7 операций на 520[^₾]*₾$/);
    expect(sortOutBanner('Покупки', bucket(1, 5))).toMatch(/^Удаление «Покупки»: осталась 1 операция на/);
    const q = sortOutMerchantText('Одежда', 'Покупки', ['Zara', 'H&M'], 12);
    expect(q.title).toBe('Категория «Одежда» — только для выбранных операций или и для мерчантов?');
    expect(q.message).toBe('Мерчанты (Zara, H&M) получат категорию «Одежда» — их новые операции будут попадать туда. Прошлые месяцы останутся в «Покупки».');
    expect([q.only, q.also]).toEqual(['Только для выбранных (12)', 'И для мерчантов']);
    expect(sortOutLeaveText('Покупки').title).toBe('Прервать удаление «Покупки»?');
  });

  it('all sorted out: where they went, what is left to know', () => {
    const moved = (category_id: number | null, name: string | null, n: number, lari: number) =>
      ({ category_id, name, emoji: null, type_name: null, ...bucket(n, lari) });
    const t = sortOutDoneText('Покупки', { moved: [moved(2, 'Одежда', 7, 500), moved(3, 'Техника', 4, 300), moved(null, null, 1, 40)], deleted: { n: 0, totals: [] } },
      { current: { n: 0, totals: [] }, past: bucket(34, 2300), merchants: ['Wolt', 'Glovo'], hasPlan: true });
    expect(t.title).toBe('Все операции перенесены');
    const [list, after] = t.message.split('\n\n');
    expect(list.split('\n')).toEqual([
      expect.stringMatching(/^12 операций на 840[^₾]*₾:$/),
      expect.stringMatching(/^• в «Одежда» — 7 на 500[^₾]*₾$/),
      expect.stringMatching(/^• в «Техника» — 4 на 300[^₾]*₾$/),
      expect.stringMatching(/^• без категории — 1 на 40[^₾]*₾$/),
    ]);
    expect(after).toMatch(/останутся в «Покупки» — история и отчёты не изменятся\. 2 мерчанта \(Wolt, Glovo\) всё ещё с категорией «Покупки» — после удаления останутся без категории\. План «Покупки» на этот месяц удалится\.$/);

    const one = sortOutDoneText('Покупки', { moved: [moved(2, 'Одежда', 12, 840)], deleted: { n: 1, totals: [] } },
      { current: { n: 0, totals: [] }, past: { n: 0, totals: [] }, merchants: [], hasPlan: false });
    expect(one.message.split('\n')).toEqual([expect.stringMatching(/^12 операций на 840[^₾]*₾ перенесены в «Одежда»\.$/), 'Удалено: 1 операция.']);
  });
});
