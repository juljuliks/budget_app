jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { setPlanAmount } from '../../src/db/plans';
import { createCategory } from '../../src/db/categories';
import { addManualTransaction } from '../../src/db/transactions';
import { loadNorms } from '../../src/stats/norms';
import { summaryGroups } from '../../src/entities/plan/model/summaryGroups';
import { freshDb } from '../helpers';

// October 2025: 31 days; Mon Sep 29 – Sun Oct 5
const spend = (amount: number, categoryId: number | null, day: string) =>
  addManualTransaction({ amount_minor: amount, category_id: categoryId, occurred_at: Math.floor(new Date(`${day}T12:00:00`).getTime() / 1000), kind: 'purchase', currency: 'GEL' });
const LATER = '2026-01-01';

beforeEach(() => freshDb());

async function setup() {
  const food = await createCategory('Еда');
  const bars = await createCategory('Бары');
  const tech = await createCategory('Техника');
  const rent = await createCategory('Аренда');
  await setPlanAmount('2025-10', food, 31000, 'limit', 'GEL', 'day');
  await setPlanAmount('2025-10', bars, 31000, 'limit', 'GEL', 'week');
  await setPlanAmount('2025-10', tech, 50000, 'limit', 'GEL', 'month');
  await setPlanAmount('2025-10', rent, 100000, 'fixed', 'GEL', 'month');
  await spend(500, food, '2025-10-02');
  await spend(3000, bars, '2025-10-01');
  await spend(1000, bars, '2025-10-02');
  await spend(20000, tech, '2025-10-01');
  await spend(100000, rent, '2025-10-02');
  await spend(700, null, '2025-10-02');
  return { food, bars, tech };
}

test('a day: the daily limit of the day, the weekly over its whole week, the monthly and the obligatory from the 1st, the rest outside', async () => {
  await setup();
  const day = { from: '2025-10-02', to: '2025-10-02' };
  const n = await loadNorms(day, 'GEL');
  const g = summaryGroups(n, day, 500 + 1000 + 100000 + 700, LATER);
  expect(g.map((x) => x.key)).toEqual(['day', 'week', 'month', 'fixed', 'outside']);
  const [d, w, m, f, o] = g;
  // nothing of food spent before the 2nd: 310 ₾ over the 30 days left
  expect(d.window).toBeUndefined();
  expect([d.spent, Math.round(d.limit)]).toEqual([500, Math.round(31000 / 30)]);
  expect(d.ongoing).toBe(false);
  // the whole week Sep 29 – Oct 5: Oct's 5 days of 310 / 31 (no plan in September)
  expect(w.window).toEqual({ from: '2025-09-29', to: '2025-10-05' });
  expect([w.spent, Math.round(w.limit)]).toEqual([4000, 5000]);
  expect(w.change).not.toBeNull();
  expect([m.spent, m.limit, m.change]).toEqual([20000, 50000, null]);
  // the rent: paid in full by the 2nd, against its plan; no longer outside
  expect([f.spent, f.limit, f.window]).toEqual([100000, 100000, { from: '2025-10-01', to: '2025-10-02' }]);
  // outside: only the uncategorized spending
  expect(o.spent).toBe(700);
});

test('a full week: the weekly limit over the period itself; nothing outside, no outside tile', async () => {
  const { bars } = await setup();
  const week = { from: '2025-10-06', to: '2025-10-12' };
  await spend(2000, bars, '2025-10-07');
  const n = await loadNorms(week, 'GEL');
  const g = summaryGroups(n, week, 2000, '2025-10-08');
  expect(g.map((x) => x.key)).toEqual(['day', 'week', 'month', 'fixed']);
  const w = g[1];
  expect(w.window).toBeUndefined();
  expect(w.spent).toBe(2000);
  expect(w.ongoing).toBe(true);
});

test('obligatory: a past day before the payment counts nothing of it; an overpayment is over its plan', async () => {
  const { food } = await setup();
  const before = { from: '2025-10-01', to: '2025-10-01' };
  const f1 = summaryGroups(await loadNorms(before, 'GEL'), before, 23000, LATER).find((x) => x.key === 'fixed')!;
  expect([f1.spent, f1.limit]).toEqual([0, 100000]);
  const rent = f1.items[0].id;
  await spend(5000, rent, '2025-10-03');
  const after = { from: '2025-10-03', to: '2025-10-03' };
  const f2 = summaryGroups(await loadNorms(after, 'GEL'), after, 5000, LATER).find((x) => x.key === 'fixed')!;
  expect(f2.spent).toBe(105000);
  expect(f2.spent > f2.limit).toBe(true);
  expect(food).toBeDefined();
});

test('outside the plan with the month known: against its share, the period\'s own spending apart', async () => {
  const { food, bars, tech } = await setup();
  const day = { from: '2025-10-02', to: '2025-10-02' };
  const n = await loadNorms(day, 'GEL');
  const planned = new Set([food, bars, tech, ...[...n.byCategory].filter(([, p]) => p.kind === 'fixed').map(([id]) => id)]);
  const g = summaryGroups(n, day, 500 + 1000 + 100000 + 700, LATER, { planned, spent: 1200, share: 5000 });
  const o = g.find((x) => x.key === 'outside')!;
  expect([o.spent, o.limit, o.periodSpent]).toEqual([1200, 5000, 700]);
});

test('a category over its month\'s plan leaves its rhythm block, named apart', async () => {
  const { bars } = await setup();
  // bars: 310 ₾ a month (weekly); 400 ₾ spent by the 2nd — over the month's plan
  await spend(36000, bars, '2025-10-02');
  const day = { from: '2025-10-02', to: '2025-10-02' };
  const g = summaryGroups(await loadNorms(day, 'GEL'), day, 0, LATER);
  expect(g.find((x) => x.key === 'week')).toBeUndefined();
  const food = summaryGroups(await loadNorms(day, 'GEL'), day, 0, LATER).find((x) => x.key === 'day')!;
  expect(food.overspent).toEqual([]);
});
