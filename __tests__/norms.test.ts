jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { setPlanAmount } from '../src/db/plans';
import { createCategory } from '../src/db/categories';
import { addManualTransaction } from '../src/db/transactions';
import { flatOf, limitChange, loadNorms, rhythmBar } from '../src/ui/stats/norms';
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
  await spend(27000, bars, '2025-09-10');
  await spend(6000, bars, '2025-09-29');
  await spend(8000, bars, '2025-10-02');

  const n = await loadNorms(day, 'GEL');
  const b = n.byCategory.get(bars)!;
  expect(b.window).toEqual({ from: '2025-09-29', to: '2025-10-05' });
  expect(b.windowParts.map((p) => [p.ym, p.days, p.limit, p.spentBefore, p.daysLeft])).toEqual([['2025-09', 2, 30000, 27000, 2], ['2025-10', 5, 31000, 0, 31]]);
  // what's left of each month over its days left: (300 − 270) / 2 × 2 + 310 / 31 × 5 = 30 + 50
  expect(b.windowNorm).toBeCloseTo(8000);
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
  await spend(27000, food, '2025-09-10');
  await spend(1500, food, '2025-09-30');
  await spend(100000, rent, '2025-10-01');

  const n = await loadNorms({ from: '2025-09-29', to: '2025-10-01' }, 'GEL');
  // (300 − 270) / 2 × 2 + 620 / 31 × 1 = 30 + 20
  expect(n.total).toBeCloseTo(5000);
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

test('a limit is rebalanced on what is left of the month: overspending lowers it, spending less raises it', async () => {
  const food = await createCategory('Еда');
  await setPlanAmount('2025-10', food, 31000, 'limit', 'GEL', 'day');
  const oct11 = { from: '2025-10-11', to: '2025-10-11' };
  // on pace (10 a day for 10 days): still 10 a day
  await spend(10000, food, '2025-10-05');
  expect(((await loadNorms(oct11, 'GEL')).byCategory.get(food)!).windowNorm).toBeCloseTo(1000);
  // 105 more over the first 10 days: (310 − 205) / 21 = 5 a day
  await spend(10500, food, '2025-10-06');
  expect(((await loadNorms(oct11, 'GEL')).byCategory.get(food)!).windowNorm).toBeCloseTo(500);
  // nothing spent before: (310 − 0) / 21 ≈ 14.76 a day
  const other = await createCategory('Такси');
  await setPlanAmount('2025-10', other, 31000, 'limit', 'GEL', 'day');
  expect(((await loadNorms(oct11, 'GEL')).byCategory.get(other)!).windowNorm).toBeCloseTo(31000 / 21);
});

test('limitChange: shown only when more than 5% off the plan\'s flat share, both ways', async () => {
  expect(limitChange(10500, 10000)).toBeNull();
  expect(limitChange(9500, 10000)).toBeNull();
  expect(limitChange(9400, 10000)).toBe('down');
  expect(limitChange(10600, 10000)).toBe('up');
  expect(limitChange(500, 0)).toBeNull();
  // the flat share stays plan / days in month × days whatever was spent
  const food = await createCategory('Еда');
  await setPlanAmount('2025-10', food, 31000, 'limit', 'GEL', 'day');
  await spend(20500, food, '2025-10-06');
  const b = (await loadNorms({ from: '2025-10-11', to: '2025-10-11' }, 'GEL')).byCategory.get(food)!;
  expect(flatOf(b.windowParts)).toBeCloseTo(1000);
  expect(limitChange(b.windowNorm, flatOf(b.windowParts))).toBe('down');
});

test('effect: the limit per rhythm at the period\'s start and after it', async () => {
  const bars = await createCategory('Бары');
  await setPlanAmount('2025-10', bars, 31000, 'limit', 'GEL', 'week');
  await spend(5000, bars, '2025-10-05');
  await spend(9000, bars, '2025-10-11');
  const b = (await loadNorms({ from: '2025-10-11', to: '2025-10-11' }, 'GEL')).byCategory.get(bars)!;
  // before: (310 − 50) / 21 × 7; after: (310 − 140) / 20 × 7
  expect(b.effect!.before).toBeCloseTo(((31000 - 5000) / 21) * 7);
  expect(b.effect!.after!).toBeCloseTo(((31000 - 14000) / 20) * 7);
  // the month's last day: nothing after it
  const last = (await loadNorms({ from: '2025-10-31', to: '2025-10-31' }, 'GEL')).byCategory.get(bars)!;
  expect(last.effect!.after).toBeNull();
});

test('the limit for the viewed days: a share of a weekly limit, the days of a daily one, by each month\'s plan', async () => {
  const bars = await createCategory('Бары');
  const food = await createCategory('Еда');
  await setPlanAmount('2025-10', bars, 31000, 'limit', 'GEL', 'week');
  await setPlanAmount('2025-09', food, 30000, 'limit', 'GEL', 'day');
  await setPlanAmount('2025-10', food, 62000, 'limit', 'GEL', 'day');
  await spend(4000, bars, '2025-10-02');
  await spend(27000, food, '2025-09-10');

  // Oct 1–4 of a weekly limit: 310 / 31 × 4, not the whole week's 70
  const week = await loadNorms({ from: '2025-10-01', to: '2025-10-04' }, 'GEL');
  expect(week.byCategory.get(bars)!.periodNorm).toBeCloseTo(4000);
  expect(week.byCategory.get(bars)!.periodSpent).toBe(4000);
  // Sep 29 – Oct 1 of a daily one: (300 − 270) / 2 × 2 + 620 / 31 × 1
  const across = await loadNorms({ from: '2025-09-29', to: '2025-10-01' }, 'GEL');
  expect(across.byCategory.get(food)!.periodParts.map((p) => p.ym)).toEqual(['2025-09', '2025-10']);
  expect(across.byCategory.get(food)!.periodNorm).toBeCloseTo(5000);
});

test('the everyday limit per day: every flexible category\'s per day together, before and after the period', async () => {
  const food = await createCategory('Еда');
  const bars = await createCategory('Бары');
  await setPlanAmount('2025-10', food, 31000, 'limit', 'GEL', 'day');
  await setPlanAmount('2025-10', bars, 62000, 'limit', 'GEL', 'week');
  await spend(5000, food, '2025-10-01');
  await spend(2000, food, '2025-10-02');
  const n = await loadNorms(day, 'GEL');
  // Oct 2 starts with 31 − 5 = 26 ₾ of food over 30 days and 62 ₾ of bars over 30 days (a week's 7 days → per day)
  expect(n.daily.before).toBeCloseTo((26000 + 62000) / 30);
  // after it: 24 + 62 over the 29 days left
  expect(n.daily.after).toBeCloseTo((24000 + 62000) / 29);
  expect((await loadNorms({ from: '2025-10-31', to: '2025-10-31' }, 'GEL')).daily.after).toBeNull();
});
