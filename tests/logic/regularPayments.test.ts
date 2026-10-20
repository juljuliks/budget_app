// A regular payment within the month (every day, on weekdays) and "Дата окончания": the times in a month, the carry-over
// of it and of a limit repeated each month, a repeating payment's charges up to its end; the category's own payment is its
// calendar only; "Подписки" of a category turned on and off.
jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { addPlanItem, listPlan, setPlanAmount, setPlanPinned, setRegularItem, timesInMonth } from '../../src/db/plans';
import { monthCharges, nextCharge, paymentDays, savingFor } from '../../src/db/recurring';
import { regularNote } from '../../src/screens/stats/plan/model/regularNote';
import { freshDb } from '../helpers';

beforeEach(() => freshDb());

// October 2026: the 1st a Thursday — 31 days, 4 Mondays (5, 12, 19, 26), 5 Thursdays
const MON = 1, THU = 1 << 3;

describe('the times in a month', () => {
  test('every day — the month\'s days; on weekdays — those of them; none after the end', () => {
    expect(timesInMonth('2026-10', 'day', 0)).toBe(31);
    expect(timesInMonth('2026-02', 'day', 0)).toBe(28);
    expect(timesInMonth('2026-10', 'week', MON)).toBe(4);
    expect(timesInMonth('2026-10', 'week', MON | THU)).toBe(9);
    expect(timesInMonth('2026-10', 'week', 0)).toBe(0);
    // the end on the 15th: the 5th and 12th Mondays, the first 15 days
    expect(timesInMonth('2026-10', 'week', MON, '2026-10-15')).toBe(2);
    expect(timesInMonth('2026-10', 'day', 0, '2026-10-15')).toBe(15);
    expect(timesInMonth('2026-10', 'day', 0, '2026-09-30')).toBe(0);
  });

  test('the plan\'s note: how often, the times by the amount, the next day by the calendar (this month), the end', () => {
    expect(regularNote({ every: 'day', weekdays: null, unit_minor: 500, until: null, currency: 'GEL' }, '2026-10', '2026-10-15')).toBe('каждый день · 31 × 5\u00a0₾');
    // the 15th a Thursday: it is the next; in November's plan — no next
    expect(regularNote({ every: 'week', weekdays: MON | THU, unit_minor: 3000, until: '2026-10-15', currency: 'GEL' }, '2026-10', '2026-10-15'))
      .toBe('пн, чт · 5 × 30\u00a0₾ · 15 окт · до 15 окт');
    expect(regularNote({ every: 'week', weekdays: MON, unit_minor: 3000, until: null, currency: 'GEL' }, '2026-11', '2026-10-15')).toBe('пн · 5 × 30\u00a0₾');
    expect(regularNote({ every: null, weekdays: null, unit_minor: null, until: null, currency: 'GEL' }, '2026-10', '2026-10-15')).toBeNull();
  });
});

describe('the category\'s own payment: its calendar, not its operations', () => {
  test('its charges up to yesterday are done; today\'s and later ones are waited for; none before its day or after its end', async () => {
    const own = { merchant_key: null, period: 1, due: '2026-08-05', until: null };
    const days = (await paymentDays([own], undefined, '2026-10-05'))(own);
    expect(days).toEqual(['2026-08-05', '2026-09-05']);
    expect(nextCharge(own.due, own.period, days, '2026-10-05')).toBe('2026-10-05');
    const ended = { ...own, until: '2026-08-31' };
    expect((await paymentDays([ended], undefined, '2026-10-05'))(ended)).toEqual(['2026-08-05']);
    // without a day — nothing
    expect((await paymentDays([{ ...own, due: null }], undefined, '2026-10-05'))({ ...own, due: null })).toEqual([]);
  });
});

describe('a monthly regular payment saved without a day', () => {
  test('the coming months counted from its charges get its amount by hand; other kinds and past months stay', async () => {
    const { getDb } = require('../../src/db');
    const { setUndatedAhead } = require('../../src/db/plans');
    const db = await getDb();
    await db.run(`INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES
      ('2099-01', 1, 80000, 'fixed', 'GEL'), ('2099-02', 1, 0, 'subs', 'GEL'), ('2099-03', 1, 5000, 'limit', 'GEL'), ('2098-12', 1, 0, 'subs', 'GEL')`);
    await setUndatedAhead('2099-01', 1, 80000, 'GEL');
    expect(await db.all('SELECT ym, kind, limit_minor FROM plan_items WHERE category_id = 1 ORDER BY ym')).toEqual([
      { ym: '2098-12', kind: 'subs', limit_minor: 0 }, { ym: '2099-01', kind: 'fixed', limit_minor: 80000 },
      { ym: '2099-02', kind: 'fixed', limit_minor: 80000 }, { ym: '2099-03', kind: 'limit', limit_minor: 5000 }]);
  });
});

describe('"Подписки" of a category on its page', () => {
  test('on: its own payment goes, the amount stays in the plan by hand; off: its subscriptions go', async () => {
    const { getDb } = require('../../src/db');
    const { createCategory, getCategory } = require('../../src/db/categories');
    const { savePayment, setSubscriptions, paymentsOfCategory } = require('../../src/db/recurring');
    const { currentYm } = require('../../src/db/plans');
    const db = await getDb();
    const ins = await createCategory('Страховки');
    const ym = currentYm();
    await addPlanItem(ym, ins);
    await savePayment({ category_id: ins, merchant_key: null, name: 'Страховки', amount_minor: 5000, currency: 'GEL', period: 1, due: `${ym}-28` });
    expect((await listPlan(ym)).find((i) => i.category_id === ins)).toMatchObject({ kind: 'subs', limit_minor: 5000 });
    await setSubscriptions(ins, true);
    expect(await getCategory(ins)).toMatchObject({ by_merchant: 1, recurring: 0 });
    expect(await paymentsOfCategory(ins)).toEqual([]);
    expect((await listPlan(ym)).find((i) => i.category_id === ins)).toMatchObject({ kind: 'fixed', limit_minor: 5000 });
    // a subscription: its repeating payments on again
    await savePayment({ category_id: ins, merchant_key: 'AIG', name: 'AIG', amount_minor: 7000, currency: 'GEL', period: 12, due: `${ym}-27` });
    expect(await getCategory(ins)).toMatchObject({ by_merchant: 1, recurring: 1 });
    await setSubscriptions(ins, false);
    expect(await getCategory(ins)).toMatchObject({ by_merchant: 0, recurring: 0 });
    expect(await paymentsOfCategory(ins)).toEqual([]);
    expect((await db.get('SELECT kind FROM plan_items WHERE ym = ? AND category_id = ?', [ym, ins])).kind).toBe('fixed');
  });
});

describe('carry-over', () => {
  // future months: ensureMonthPlan treats them as current or coming
  const M1 = '2099-01', M2 = '2099-02', M3 = '2099-03';

  test('a regular payment: its month the times by the amount; repeated — the next month its own days; not — gone', async () => {
    await setRegularItem(M1, 1, { every: 'day', weekdays: 0, unit_minor: 500, until: null, pinned: true }, 'GEL');
    await setRegularItem(M1, 2, { every: 'week', weekdays: MON, unit_minor: 3000, until: null, pinned: false }, 'GEL');
    expect((await listPlan(M1)).map((i) => ({ id: i.category_id, limit: i.limit_minor, kind: i.kind, every: i.every }))).toEqual([
      { id: 1, limit: 31 * 500, kind: 'fixed', every: 'day' }, { id: 2, limit: timesInMonth(M1, 'week', MON) * 3000, kind: 'fixed', every: 'week' }]);
    // February 2099: 28 days; the weekly one not repeated — not there
    expect((await listPlan(M2)).map((i) => ({ id: i.category_id, limit: i.limit_minor, every: i.every, unit: i.unit_minor }))).toEqual([
      { id: 1, limit: 28 * 500, every: 'day', unit: 500 }]);
  });

  test('"Дата окончания": a regular payment counts its days up to it and isn\'t carried past it; a limit stops repeating', async () => {
    await setRegularItem(M1, 1, { every: 'day', weekdays: 0, unit_minor: 500, until: `${M2}-10`, pinned: true }, 'GEL');
    await addPlanItem(M1, 2); await setPlanAmount(M1, 2, 30000); await setPlanPinned(M1, 2, true, `${M1}-31`);
    expect((await listPlan(M2)).map((i) => ({ id: i.category_id, limit: i.limit_minor, pinned: i.pinned, until: i.until }))).toEqual([
      // February: up to the 10th; the limit — after its end: carried without its amount, not repeated
      { id: 1, limit: 10 * 500, pinned: true, until: `${M2}-10` }, { id: 2, limit: 0, pinned: false, until: null }]);
    expect((await listPlan(M3)).map((i) => i.category_id)).toEqual([2]);
  });

  test('another kind saved: no longer a regular payment', async () => {
    await setRegularItem(M1, 1, { every: 'day', weekdays: 0, unit_minor: 500, until: null, pinned: true }, 'GEL');
    await setPlanAmount(M1, 1, 20000, 'fixed');
    expect((await listPlan(M1))[0]).toMatchObject({ limit_minor: 20000, every: null, unit_minor: null });
  });
});

describe('a repeating payment\'s end', () => {
  test('no charges after it: the month\'s, the next one, what is saved for', () => {
    expect(monthCharges('2026-10-05', 1, '2026-11', [], '2026-10-01', '2026-11-30')).toEqual([{ day: '2026-11-05', done: false }]);
    expect(monthCharges('2026-10-05', 1, '2026-12', [], '2026-10-01', '2026-11-30')).toEqual([]);
    // weekly: the month's charges up to the 15th
    expect(monthCharges('2026-10-01', -1, '2026-10', [], '2026-10-01', '2026-10-15').map((c) => c.day)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
    expect(nextCharge('2026-10-05', 1, [], '2026-10-20', '2026-10-31')).toBeNull();
    expect(nextCharge('2026-10-05', 1, [], '2026-10-20', '2026-12-31')).toBe('2026-11-05');
    expect(savingFor('2026-10-05', 12, '2026-11', [], '', '2027-06-30')).toBeNull();
    expect(savingFor('2026-10-05', 12, '2026-11', [], '')).toBe('2027-10-05');
  });
});
