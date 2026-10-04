jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { setPlanAmount } from '../src/db/plans';
import { createCategory } from '../src/db/categories';
import { addManualTransaction } from '../src/db/transactions';
import { loadNorms, rhythmBar } from '../src/ui/stats/norms';
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

describe('rhythmBar: the bar over the category\'s own rhythm', () => {
  const week = { from: '2026-09-28', to: '2026-10-04' };
  test('a day inside a week: faded — the week\'s other days, the tick — how much of the week has passed', () => {
    const bar = rhythmBar({ rhythm: 'week', window: week, windowNorm: 10000, windowSpent: 6000 }, { from: '2026-10-01', to: '2026-10-01' }, 2000);
    expect(bar.ratio).toBeCloseTo(0.6);
    expect(bar.base).toBeCloseTo(0.4);
    expect(bar.marker).toBeCloseTo(4 / 7);
    expect(bar.end).toBe('2026-10-04');
  });
  test('the last day of the week: nothing after it', () => {
    const bar = rhythmBar({ rhythm: 'week', window: week, windowNorm: 10000, windowSpent: 14000 }, { from: '2026-10-04', to: '2026-10-04' }, 8000);
    expect(bar.ratio).toBeCloseTo(1.4);
    expect(bar.marker).toBe(1);
    expect(bar.end).toBeUndefined();
  });
  test('a month rhythm spans the whole month, its window being only the days so far', () => {
    const bar = rhythmBar({ rhythm: 'month', window: { from: '2026-10-01', to: '2026-10-04' }, windowNorm: 31000, windowSpent: 3100 }, { from: '2026-10-04', to: '2026-10-04' }, 0);
    expect(bar.marker).toBeCloseTo(4 / 31);
    expect(bar.end).toBe('2026-10-31');
    expect(bar.base).toBeCloseTo(0.1);
  });
  test('a day norm over the viewed day: no tick, no faded part', () => {
    const day1 = { from: '2026-10-04', to: '2026-10-04' };
    const bar = rhythmBar({ rhythm: 'day', window: day1, windowNorm: 1000, windowSpent: 500 }, day1, 500);
    expect(bar).toEqual({ ratio: 0.5, base: 0, marker: undefined, end: undefined });
  });
  test('no norm (no plan in those months): spent shows as a full bar', () => {
    expect(rhythmBar({ rhythm: 'week', window: week, windowNorm: 0, windowSpent: 100 }, week, 100).ratio).toBe(1);
  });
});
