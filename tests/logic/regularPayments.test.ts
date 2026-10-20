// A regular payment within the month (every day, on weekdays) and "Дата окончания": the times in a month, the carry-over
// of it and of a limit repeated each month, a repeating payment's charges up to its end.
jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { addPlanItem, listPlan, setPlanAmount, setPlanPinned, setRegularItem, timesInMonth } from '../../src/db/plans';
import { monthCharges, nextCharge, savingFor } from '../../src/db/recurring';
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

  test('the plan\'s note: how often, the times by the amount, the end', () => {
    expect(regularNote({ every: 'day', weekdays: null, unit_minor: 500, until: null, currency: 'GEL' }, '2026-10')).toBe('каждый день · 31 × 5\u00a0₾');
    expect(regularNote({ every: 'week', weekdays: MON | THU, unit_minor: 3000, until: '2026-10-15', currency: 'GEL' }, '2026-10'))
      .toBe('пн, чт · 5 × 30\u00a0₾ · до 15 окт');
    expect(regularNote({ every: null, weekdays: null, unit_minor: null, until: null, currency: 'GEL' }, '2026-10')).toBeNull();
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
