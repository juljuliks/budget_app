// "Подписки" (db/recurring, db/plans/recurringItems.ts): the system category, the plan's item counted from the
// charges, the amount by hand until one has a day, the month's sections, the merchants without a subscription.
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import { subscriptionsCategoryId } from '../../src/db/categories';
import { listPlan, monthPayments, setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { deletePayment, merchantsWithoutPayment, savePayment, paymentOfMerchant } from '../../src/db/recurring';

let n = 0;
const at = (s: string) => Math.floor(new Date(s).getTime() / 1000);
/** A bank operation of `merchant` (its key the same) in `categoryId`. */
async function charge(merchant: string, amount: number, when: string, categoryId: number | null) {
  n++;
  await (await getDb()).run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', ?, 'GEL', ?, ?, ?, 'user', ?, ?, ?)`,
    [amount, merchant, merchant, categoryId, at(when), `sms ${n}`, `h${n}`]);
}
const NETFLIX = { merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL' as const, period_months: 1 };

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
  await savePayment({ category_id: insurance, merchant_key: 'GPI', name: 'GPI', amount_minor: 12000, currency: 'GEL', period_months: 12, due: '2027-10-05' });
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
  await savePayment({ merchant_key: 'APPLE', name: 'iCloud+', amount_minor: 10000, currency: 'GEL', period_months: 12, due: '2027-03-12' });
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
  await savePayment({ merchant_key: 'SPOTIFY', name: 'Spotify', amount_minor: 1840, currency: 'GEL', period_months: 1, due: '2026-10-25' });
  await savePayment({ merchant_key: 'ADOBE', name: 'Adobe', amount_minor: 8900, currency: 'USD', period_months: 12, due: '2027-06-03' });
  await savePayment({ merchant_key: 'YOUTUBE', name: 'YouTube', amount_minor: 1599, currency: 'GEL', period_months: 1, due: null });
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

test('a payment without a merchant (put in from the plan) is charged by any spending of its category', async () => {
  const { createCategory } = require('../../src/db/categories');
  const { turnRecurring, paymentCard } = require('../../src/db/recurring');
  const sport = await createCategory('Спорт', '🏋️');
  await turnRecurring(sport, true);
  await savePayment({ category_id: sport, merchant_key: null, name: 'Спорт', amount_minor: 30000, currency: 'GEL', period_months: 1, due: '2026-10-05' });
  // no operation yet: expected on the 5th
  expect((await monthPayments('2026-10', 'GEL')).charges).toEqual([expect.objectContaining({ day: '2026-10-05', done: false })]);
  await charge('FITPASS', 30000, '2026-10-06T10:00:00', sport);
  expect((await monthPayments('2026-10', 'GEL')).charges).toEqual([expect.objectContaining({ day: '2026-10-05', done: true })]);
  // its card for an operation of any merchant of the category
  expect((await paymentCard('FITPASS', new Date('2026-10-18T12:00:00'), sport))?.next).toBe('2026-11-05');
});
