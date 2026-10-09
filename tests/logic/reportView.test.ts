// What the month's report says (features/month-report/model/reportView): what to improve, what is good, their year.
import { reportView } from '../../src/features/month-report/model/reportView';
import type { MonthReport } from '../../src/db/report';

const report = (p: Partial<MonthReport>): MonthReport => ({
  currency: 'GEL', hasPlan: true, saved: 50000, previousSaved: null, spent: 150000, budget: 200000, toSavings: true,
  overLimitsTotal: 0, overLimits: [], unplannedOver: 0, unplannedSpent: 0, unplannedShare: 0, unplannedOfSpending: 0, review: false,
  uncategorizedCount: 0, unpaid: [], locked: 0, lockedTouched: 0, savedInPlan: 0, underPlan: [], movedToSavings: 0, couldSaveMore: 0,
  topUnplanned: [], average: null, savedFrom: null,
  ...p,
} as unknown as MonthReport);

test('the overspends add up to what they cost a year', () => {
  const v = reportView(report({ overLimitsTotal: 15000, unplannedOver: 40000 }), 'GEL');
  expect(v.improve).toBe(true);
  expect(v.badMonth).toBe(55000);
  expect(v.yearInfo(v.badParts, '−', '…')).toBe('Перерасход лимитов 150 ₾ + вне плана сверх доли 400 ₾ = 550 ₾ за месяц; × 12 = −6 600 ₾. …');
});

test('more put aside than the month before: good; less: to improve', () => {
  expect(reportView(report({ saved: 60000, previousSaved: 50000 }), 'GEL')).toMatchObject({ better: 10000, worse: 0, goodMonth: 10000 });
  expect(reportView(report({ saved: 40000, previousSaved: 50000 }), 'GEL')).toMatchObject({ better: 0, worse: 10000, improve: true });
});

test('nothing overspent and the limits kept: only good', () => {
  const v = reportView(report({}), 'GEL');
  expect([v.improve, v.good]).toEqual([false, true]);
});

test('outside the plan: what the share was and what went past it', () => {
  expect(reportView(report({ unplannedSpent: 30000, unplannedShare: 20000 }), 'GEL').unplannedInfo)
    .toContain('сверх неё — 100 ₾: эти деньги не отложились.');
});
