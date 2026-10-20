// A regular payment within the month (every day, on weekdays) and "Дата окончания": the times in a month, the carry-over
// of it and of a limit repeated each month, a repeating payment's charges up to its end.
jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { addPlanItem, listPlan, paidTimes, regularDays, setPlanAmount, setPlanPinned, setRegularItem, timesInMonth } from '../../src/db/plans';
import { countsFor, matchesAmount, monthCharges, nextCharge, paidDays, savingFor } from '../../src/db/recurring';
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

describe('paid by the category\'s spending', () => {
  const TUE = 1 << 1;
  const at = (...xs: Array<[string, number, (number | null)?]>) => xs.map(([day, minor, answer]) => ({ day, minor, answer: answer ?? null }));
  test('its amount within ±3% (1 ₾ at least) — by itself; another one — only answered "Это оплата?" yes', () => {
    expect(matchesAmount(14600, 15000)).toBe(true);
    expect(matchesAmount(14400, 15000)).toBe(false);
    // a small amount: 1 ₾
    expect(matchesAmount(560, 500)).toBe(true);
    expect(countsFor({ minor: 30000, answer: null }, 15000)).toBe(false);
    expect(countsFor({ minor: 30000, answer: 1 }, 15000)).toBe(true);
    expect(countsFor({ minor: 15000, answer: 0 }, 15000)).toBe(false);
  });

  test('every week: the spending within ±3 days of one (closer days — less) adding up to the amount; one pays one day', () => {
    // October: Tuesdays 6, 13, 20, 27
    const tuesdays = regularDays('2026-10', 'week', TUE);
    expect(tuesdays).toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']);
    expect(paidTimes(tuesdays, TUE, at(['2026-10-05', 15000], ['2026-10-16', 15000]), 15000)).toBe(2);
    // half and half: answered yes — paid; not answered — not
    expect(paidTimes(tuesdays, TUE, at(['2026-10-05', 7500, 1], ['2026-10-07', 7500, 1]), 15000)).toBe(1);
    expect(paidTimes(tuesdays, TUE, at(['2026-10-05', 7500], ['2026-10-07', 7500]), 15000)).toBe(0);
    // a bigger one not answered (sneakers) — not
    expect(paidTimes(tuesdays, TUE, at(['2026-10-06', 30000]), 15000)).toBe(0);
    expect(paidTimes(tuesdays, TUE, at(['2026-10-01', 15000]), 15000)).toBe(0);
    // Monday and Thursday: ±1 day — Wednesday the 7th pays Thursday only
    const monThu = regularDays('2026-10', 'week', MON | THU);
    expect(paidTimes(monThu, MON | THU, at(['2026-10-07', 2000]), 2000)).toBe(1);
    expect(paidTimes(monThu, MON | THU, at(['2026-10-06', 2000], ['2026-10-09', 2000]), 2000)).toBe(2);
  });

  test('the category\'s own payment: paid on the day what counts for it reached the amount', () => {
    expect(paidDays(at(['2026-10-01', 5000, 1], ['2026-10-03', 5000, 1], ['2026-10-20', 1000]), 10000, 7)).toEqual(['2026-10-03']);
    // too far apart to be one payment
    expect(paidDays(at(['2026-10-01', 5000, 1], ['2026-10-20', 5000, 1]), 10000, 7)).toEqual([]);
    expect(paidDays(at(['2026-10-01', 9800], ['2026-11-02', 10000]), 10000, 7)).toEqual(['2026-10-01', '2026-11-02']);
    // answered no: not, though of its amount
    expect(paidDays(at(['2026-10-01', 10000, 0]), 10000, 7)).toEqual([]);
  });
});

describe('the savings forecast of the current month', () => {
  test('a regular payment expects its days paid and those to come: a Tuesday gone unpaid is skipped', async () => {
    const { regularExpected } = require('../../src/db/plans');
    const { getDb } = require('../../src/db');
    const { createCategory } = require('../../src/db/categories');
    const { addManualTransaction } = require('../../src/db/transactions');
    const shrink = await createCategory('Психолог');
    // October 2026: Tuesdays 6, 13, 20, 27; the 6th paid, the 13th not; today the 15th
    await addManualTransaction({ amount_minor: 15000, category_id: shrink, occurred_at: Math.floor(new Date('2026-10-06T12:00:00').getTime() / 1000), kind: 'transfer' });
    const row = { category_id: shrink, currency: 'GEL', every: 'week' as const, weekdays: 1 << 1, unit_minor: 15000, until: null };
    const expected = await regularExpected('2026-10', [row], await getDb(), new Date('2026-10-15T12:00:00'));
    // paid one + the 20th and 27th to come: 3 × 150 ₾ (the plan 4 × 150 ₾)
    expect(expected.get(shrink)).toBe(45000);
    expect((await regularExpected('2026-11', [row], await getDb(), new Date('2026-10-15T12:00:00'))).size).toBe(0);
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

describe('"Это оплата?" waiting, in the list and the stats', () => {
  test('another currency than the payment\'s: by the rate of its day — of its amount, not asked; another — asked; no rate — not', async () => {
    const { getDb } = require('../../src/db');
    const { createCategory } = require('../../src/db/categories');
    const { addManualTransaction } = require('../../src/db/transactions');
    const { savePayment, askingSql } = require('../../src/db/recurring');
    const db = await getDb();
    const home = await createCategory('Аренда');
    await savePayment({ category_id: home, merchant_key: null, name: 'Аренда', amount_minor: 270000, currency: 'GEL', period: 1, due: '2026-10-05' });
    await db.run("INSERT INTO fx_rates (date, currency, gel_per_unit) VALUES ('2026-10-01', 'USD', 2.7)");
    const at = Math.floor(new Date('2026-10-05T12:00:00').getTime() / 1000);
    // 1 000 $ = 2 700 ₾: the payment's; 500 $ — not; 1 000 € — no rate: not asked
    const usd = await addManualTransaction({ amount_minor: 100000, currency: 'USD', category_id: home, occurred_at: at, kind: 'transfer' });
    const half = await addManualTransaction({ amount_minor: 50000, currency: 'USD', category_id: home, occurred_at: at, kind: 'transfer' });
    const eur = await addManualTransaction({ amount_minor: 100000, currency: 'EUR', category_id: home, occurred_at: at, kind: 'transfer' });
    const asks = async (id: number) => (await db.get(`SELECT ${askingSql('t', 't.amount_minor')} AS a FROM transactions t WHERE t.id = ?`, [id])).a;
    expect([await asks(usd), await asks(half), await asks(eur)]).toEqual([0, 1, 0]);
  });
});
