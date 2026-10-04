jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { setPlanAmount } from '../src/db/plans';
import { createCategory } from '../src/db/categories';
import { addManualTransaction } from '../src/db/transactions';
import { loadNorms } from '../src/ui/stats/norms';
import { freshDb } from './helpers';

// past months (never created by looking at them): Sep 2025 has 30 days, Oct 2025 — 31; Mon Sep 29 – Sun Oct 5
const spend = (amount: number, categoryId: number, day: string) =>
  addManualTransaction({ amount_minor: amount, category_id: categoryId, occurred_at: Math.floor(new Date(`${day}T12:00:00`).getTime() / 1000), kind: 'purchase', currency: 'GEL' });
const day = { from: '2025-10-02', to: '2025-10-02' };

beforeEach(() => freshDb());

test('a week across two months: each month\'s days by its own plan, spending over the whole week', async () => {
  const bars = await createCategory('Бары');
  await setPlanAmount('2025-09', bars, 30000, 'limit', 'GEL', 'week');
  await setPlanAmount('2025-10', bars, 31000, 'limit', 'GEL', 'week');
  await spend(6000, bars, '2025-09-29');
  await spend(8000, bars, '2025-10-02');

  const n = await loadNorms(day, 'GEL');
  const b = n.byCategory.get(bars)!;
  expect(b.window).toEqual({ from: '2025-09-29', to: '2025-10-05' });
  expect(b.windowParts.map((p) => [p.ym, p.days, p.limit])).toEqual([['2025-09', 2, 30000], ['2025-10', 5, 31000]]);
  // 300 / 30 × 2 + 310 / 31 × 5 = 20 + 50
  expect(b.windowNorm).toBeCloseTo(7000);
  expect(b.windowSpent).toBe(14000);
  // the month's share and the pace are about October
  expect(b.monthLimit).toBe(31000);
  expect(b.spent).toBe(8000);
  expect(n.monthToDate.get(bars)).toBe(8000);
});

test('a month without the category\'s plan counts as 0', async () => {
  const bars = await createCategory('Бары');
  await setPlanAmount('2025-10', bars, 31000, 'limit', 'GEL', 'week');
  const n = await loadNorms(day, 'GEL');
  const b = n.byCategory.get(bars)!;
  expect(b.windowParts.map((p) => [p.ym, p.limit, p.norm])).toEqual([['2025-09', 0, 0], ['2025-10', 31000, 5000]]);
  expect(b.windowNorm).toBe(5000);
});

test('the overall pace: a custom period across months, flexible per-day categories only', async () => {
  const food = await createCategory('Еда');
  const rent = await createCategory('Аренда');
  await setPlanAmount('2025-09', food, 30000, 'limit', 'GEL', 'day');
  await setPlanAmount('2025-10', food, 62000, 'limit', 'GEL', 'day');
  await setPlanAmount('2025-10', rent, 100000, 'fixed', 'GEL', 'month');
  await spend(1500, food, '2025-09-30');
  await spend(100000, rent, '2025-10-01');

  const n = await loadNorms({ from: '2025-09-29', to: '2025-10-01' }, 'GEL');
  // 300 / 30 × 2 + 620 / 31 × 1 = 20 + 20
  expect(n.total).toBeCloseTo(4000);
  expect(n.flexSpent).toBe(1500);
  expect(n.flex.map((f) => f.name)).toEqual(['Еда']);
});
