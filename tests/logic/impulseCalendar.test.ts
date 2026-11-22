// 5.8.10 «Покупки по дням»: a category's purchases by day for the calendar of its «Динамика».
import type { ImpulseRow } from '../../src/db/impulseStats';
import { dayCardTitle, firstMonth, monthTally, purchasesByDay } from '../../src/entities/transaction/model/impulseCalendarView';

const row = (tx: number, day: string, value: number, impulse: boolean | null, mood: string | null = null, merchant = 'ZARA'): ImpulseRow =>
  ({ tx, category: 1, day, value, impulse, mood, merchantKey: merchant, merchant });

const rows = [
  row(1, '2026-11-16', 3900, null, null, 'HM'),
  row(2, '2026-10-03', 3500, false, null, 'HM'),
  row(3, '2026-10-03', 8900, true, 'happy'),
  // a split purchase: two parts in the category, one purchase
  row(4, '2026-10-17', 10000, true, 'sad'),
  row(4, '2026-10-17', 4000, true, 'sad'),
  row(5, '2026-09-06', 11000, null),
];

test('a day\'s purchases: a split one\'s parts together, impulsive first, then considered, then unanswered', () => {
  const days = purchasesByDay(rows);
  expect(days.get('2026-10-03')!.map((p) => [p.tx, p.mark, p.mood])).toEqual([[3, 'impulsive', 'happy'], [2, 'intentional', null]]);
  expect(days.get('2026-10-17')).toEqual([{ tx: 4, merchant: 'ZARA', value: 14000, mark: 'impulsive', mood: 'sad' }]);
  expect(days.get('2026-11-16')![0].mark).toBe('unanswered');
  expect(days.has('2026-10-04')).toBe(false);
});

test('a month\'s count and sum; the first month the calendar goes back to', () => {
  const days = purchasesByDay(rows);
  expect(monthTally(days, '2026-10')).toEqual({ count: 3, sum: 26400 });
  expect(monthTally(days, '2026-08')).toEqual({ count: 0, sum: 0 });
  expect(firstMonth(days, '2026-11-17')).toBe('2026-09');
  expect(firstMonth(new Map(), '2026-11-17')).toBe('2026-11');
});

test('the card\'s title: weekday and day', () => {
  expect(dayCardTitle('2026-11-16')).toBe('понедельник, 16 ноября');
  expect(dayCardTitle('2026-10-03')).toBe('суббота, 3 октября');
});
