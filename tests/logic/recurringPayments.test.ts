// "Подписки" (db/recurring, db/plans/recurringItems.ts): the system category, the plan's item counted from the
// charges, the amount by hand until one has a day, the month's sections, the merchants without a subscription.
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import { subscriptionsCategoryId } from '../../src/db/categories';
import { listPlan, monthPayments, monthStats, setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { deletePayment, merchantsWithoutPayment, savePayment, paymentOfMerchant } from '../../src/db/recurring';

let n = 0;
const at = (s: string) => Math.floor(new Date(s).getTime() / 1000);
/** A bank operation of `merchant` (its key the same) in `categoryId`. */
async function charge(merchant: string, amount: number, when: string, categoryId: number | null, kind = 'purchase') {
  n++;
  await (await getDb()).run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', ?, ?, 'GEL', ?, ?, ?, 'user', ?, ?, ?)`,
    [kind, amount, merchant, merchant, categoryId, at(when), `sms ${n}`, `h${n}`]);
}
const NETFLIX = { merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL' as const, period: 1 };

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-18T12:00:00'), advanceTimers: true });
  await freshDb();
  await setPlanBudget('2026-10', 500000, 'GEL');
});
afterEach(() => jest.useRealTimers());

test('"Подписки" is a category of its own with repeating payments on (not a system one)', async () => {
  const id = await subscriptionsCategoryId();
  const row = await (await getDb()).get<{ name: string; system: string | null; recurring: number }>('SELECT name, system, recurring FROM categories WHERE id = ?', [id]);
  expect(row).toEqual({ name: 'Подписки', system: null, recurring: 1 });
});

test('any category can have repeating payments: its plan counted from them; off — the amount stays, by hand; "Отменить"', async () => {
  const { createCategory } = require('../../src/db/categories');
  const { turnRecurring, undoRecurring } = require('../../src/db/recurring');
  const insurance = await createCategory('Страховка', '🛡');
  await turnRecurring(insurance, true);
  await charge('GPI', 12000, '2026-10-05T10:00:00', insurance);
  await savePayment({ category_id: insurance, merchant_key: 'GPI', name: 'GPI', amount_minor: 12000, currency: 'GEL', period: 12, due: '2027-10-05' });
  const item = async () => (await listPlan('2026-10')).find((i) => i.category_id === insurance);
  expect(await item()).toMatchObject({ kind: 'subs', limit_minor: 12000, recurring: true });
  // "Подписки" keeps its own
  expect((await listPlan('2026-10')).find((i) => i.name === 'Подписки')).toBeUndefined();
  const undo = await turnRecurring(insurance, false);
  expect(await item()).toMatchObject({ kind: 'fixed', limit_minor: 12000, recurring: false });
  await undoRecurring(undo);
  expect(await item()).toMatchObject({ kind: 'subs', recurring: true });
});

test('until a subscription has a day the amount put in by hand stays; then it is the charges', async () => {
  const subs = (await subscriptionsCategoryId())!;
  await setPlanAmount('2026-10', subs, 25000, 'fixed', 'GEL');
  await charge('NETFLIX.COM', 3000, '2026-10-18T10:00:00', subs);
  // "Пропустить": no day — still by hand
  await savePayment({ ...NETFLIX, due: null });
  expect((await listPlan('2026-10')).find((i) => i.category_id === subs)).toMatchObject({ kind: 'fixed', limit_minor: 25000 });
  // a day: October's charge (done, the operation of the 18th) is the plan
  await savePayment({ ...NETFLIX, due: '2026-11-18' });
  expect((await listPlan('2026-10')).find((i) => i.category_id === subs)).toMatchObject({ kind: 'subs', limit_minor: 3000 });
  // a year one charged in March isn't October's
  await savePayment({ merchant_key: 'APPLE', name: 'iCloud+', amount_minor: 10000, currency: 'GEL', period: 12, due: '2027-03-12' });
  expect((await listPlan('2026-10')).find((i) => i.category_id === subs)!.limit_minor).toBe(3000);
  expect((await listPlan('2027-03')).find((i) => i.category_id === subs)!.limit_minor).toBe(13000);
  // deleted: counted on, 0 with none charged
  await deletePayment((await paymentOfMerchant('NETFLIX.COM'))!.id);
  expect((await listPlan('2026-10')).find((i) => i.category_id === subs)!.limit_minor).toBe(0);
});

test("the month's sections: charged in it by day, the others by their next charge, those without a day", async () => {
  const subs = (await subscriptionsCategoryId())!;
  await charge('NETFLIX.COM', 3000, '2026-10-18T10:00:00', subs);
  await savePayment({ ...NETFLIX, due: '2026-11-18' });
  await savePayment({ merchant_key: 'SPOTIFY', name: 'Spotify', amount_minor: 1840, currency: 'GEL', period: 1, due: '2026-10-25' });
  await savePayment({ merchant_key: 'ADOBE', name: 'Adobe', amount_minor: 8900, currency: 'USD', period: 12, due: '2027-06-03' });
  await savePayment({ merchant_key: 'YOUTUBE', name: 'YouTube', amount_minor: 1599, currency: 'GEL', period: 1, due: null });
  const m = await monthPayments('2026-10', 'GEL');
  expect(m.charges.map((c) => [c.sub.name, c.day, c.done])).toEqual([['Netflix', '2026-10-18', true], ['Spotify', '2026-10-25', false]]);
  expect(m.total_minor).toBe(4840);
  expect(m.later.map((l) => [l.sub.name, l.next])).toEqual([['Adobe', '2027-06-03']]);
  expect(m.undated.map((s) => s.name)).toEqual(['YouTube']);
  // November: Netflix and Spotify again, Adobe next in June
  const nov = await monthPayments('2026-11', 'GEL');
  expect(nov.charges.map((c) => c.day)).toEqual(['2026-11-18', '2026-11-25']);
});

test('the merchants charged in "Подписки" with no subscription: their last charge', async () => {
  const subs = (await subscriptionsCategoryId())!;
  await charge('YOUTUBE', 1599, '2026-09-02T09:00:00', subs);
  await charge('YOUTUBE', 1599, '2026-10-02T09:00:00', subs);
  await charge('NETFLIX.COM', 3000, '2026-10-18T10:00:00', subs);
  await charge('SPAR', 500, '2026-10-10T10:00:00', null);
  await savePayment({ ...NETFLIX, due: '2026-11-18' });
  expect(await merchantsWithoutPayment(subs)).toEqual([
    { merchant_key: 'YOUTUBE', name: 'YOUTUBE', day: '2026-10-02', amount_minor: 1599, currency: 'GEL' },
  ]);
});

test('rent by transfer — the category\'s own payment: its charges by the calendar, its spending isn\'t matched; a subscription — its merchant\'s purchases only', async () => {
  const { createCategory } = require('../../src/db/categories');
  const rent = await createCategory('Аренда', '🏠');
  await savePayment({ category_id: rent, merchant_key: null, name: 'Аренда', amount_minor: 130000, currency: 'GEL', period: 1, due: '2099-01-05' });
  expect((await (await getDb()).get<{ r: number }>('SELECT recurring AS r FROM categories WHERE id = ?', [rent]))!.r).toBe(1);
  // a transfer of its amount near its day: still the plan's charge only
  await charge('LANDLORD', 130000, '2099-01-06T10:00:00', rent, 'transfer');
  expect((await monthPayments('2099-01', 'GEL', undefined, rent)).charges).toEqual([expect.objectContaining({ day: '2099-01-05', done: false })]);

  // a subscription: a transfer to its merchant isn't its charge
  const sport = await createCategory('Спорт', '🏋️');
  await savePayment({ category_id: sport, merchant_key: 'COACH', name: 'Тренер', amount_minor: 5000, currency: 'GEL', period: 1, due: '2026-10-10' });
  await charge('COACH', 5000, '2026-10-10T10:00:00', sport, 'transfer');
  expect((await monthPayments('2026-10', 'GEL', undefined, sport)).charges).toEqual([expect.objectContaining({ day: '2026-10-10', done: false })]);
});

test('a category\'s last payment deleted: its repeating payments go off, the item a one-off one; "Отменить" puts both back', async () => {
  const { createCategory } = require('../../src/db/categories');
  const { turnRecurring, restorePayment } = require('../../src/db/recurring');
  const rent = await createCategory('Аренда', '🏠');
  await turnRecurring(rent, true);
  const id = await savePayment({ category_id: rent, merchant_key: null, name: 'Аренда', amount_minor: 130000, currency: 'GEL', period: 1, due: '2026-10-13' });
  const recurring = async () => (await (await getDb()).get<{ r: number }>('SELECT recurring AS r FROM categories WHERE id = ?', [rent]))!.r;
  expect((await listPlan('2026-10')).find((i) => i.category_id === rent)).toMatchObject({ kind: 'subs', limit_minor: 130000 });
  const deleted = await deletePayment(id);
  expect(deleted.off).not.toBeNull();
  expect(await recurring()).toBe(0);
  expect((await listPlan('2026-10')).find((i) => i.category_id === rent)).toMatchObject({ kind: 'fixed', limit_minor: 130000 });
  await restorePayment(id, deleted);
  expect(await recurring()).toBe(1);
  expect((await listPlan('2026-10')).find((i) => i.category_id === rent)).toMatchObject({ kind: 'subs', limit_minor: 130000 });
});

test('a category with "Подписки" without subscriptions keeps its repeating payments on', async () => {
  const subs = (await subscriptionsCategoryId())!;
  const id = await savePayment({ ...NETFLIX, due: '2026-11-18' });
  expect((await deletePayment(id)).off).toBeNull();
  expect(await (await getDb()).get('SELECT recurring FROM categories WHERE id = ?', [subs])).toEqual({ recurring: 1 });
});

test('a subscription already charged is planned at its charge day\'s rate; one still waited for, at today\'s', async () => {
  jest.setSystemTime(new Date('2026-10-21T12:00:00'));
  const subs = (await subscriptionsCategoryId())!;
  const db = await getDb();
  // the 18th has no rate (a Sunday): the charge takes the 17th's, the plan's rate day is today, the 21st
  await db.run("INSERT INTO fx_rates (date, currency, gel_per_unit) VALUES ('2026-10-17', 'USD', 2.5982), ('2026-10-21', 'USD', 2.5978)");
  await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', 3999, 'USD', 'APPLE.COM/BILL', 'APPLE', ?, 'user', ?, 'sms apple', 'h-apple')`,
    [subs, at('2026-10-18T10:00:00')]);
  await savePayment({ merchant_key: 'APPLE', name: 'Apple', amount_minor: 3999, currency: 'USD', period: 12, due: '2027-10-18' });
  await savePayment({ merchant_key: 'WAIT', name: 'Wait', amount_minor: 3999, currency: 'USD', period: 1, due: '2026-10-25' });
  // both in dollars: the item stays in dollars; shown in lari — 39.99 $ paid on the 18th is 103.90 ₾, the one on the 25th is 103.89 ₾ today
  const shown = (await listPlan('2026-10', 'GEL')).find((i) => i.category_id === subs);
  expect(shown).toMatchObject({ limit_minor: 7998, currency: 'USD', converted_minor: 20779 });
  // a lari one too, so the item is kept in lari (39.99 × 2.5982 → 103.90, plus 103.89, plus 2.00)
  await savePayment({ merchant_key: 'GOOGLE', name: 'Google', amount_minor: 200, currency: 'GEL', period: 1, due: '2026-10-25' });
  expect(await db.get("SELECT limit_minor, currency FROM plan_items WHERE ym = '2026-10' AND category_id = ?", [subs])).toEqual({ limit_minor: 20979, currency: 'GEL' });
  // what an earlier count stored, while the dollar was cheaper: opening the month puts the charge day back
  await db.run('UPDATE plan_items SET limit_minor = ? WHERE ym = ? AND category_id = ?', [20978, '2026-10', subs]);
  const row = (await monthStats(2026, 9, 'GEL')).categories.find((c) => c.category_id === subs);
  expect(row).toMatchObject({ spent_minor: 10390, limit_minor: 20979 });
  expect(await db.get('SELECT limit_minor AS n FROM plan_items WHERE ym = ? AND category_id = ?', ['2026-10', subs])).toEqual({ n: 20979 });
});

test('a budget in dollars: the item of payments in lari is in lari — 750 ₾ stays 750 ₾ (not 288.61 $ shown as 749.99 ₾)', async () => {
  const { createCategory } = require('../../src/db/categories');
  const db = await getDb();
  const sport = await createCategory('Спорт', '🏋️');
  await db.run("INSERT OR REPLACE INTO plan_months (ym, budget_minor, budget_currency) VALUES ('2026-10', 400000, 'USD')");
  await db.run("INSERT INTO fx_rates (date, currency, gel_per_unit) VALUES ('2026-10-01', 'USD', 2.5987)");
  await savePayment({ category_id: sport, merchant_key: null, name: 'Спорт', amount_minor: 75000, currency: 'GEL', period: 1, due: '2026-10-20' });
  expect(await db.get("SELECT limit_minor, currency FROM plan_items WHERE ym = '2026-10' AND category_id = ?", [sport])).toEqual({ limit_minor: 75000, currency: 'GEL' });
});
