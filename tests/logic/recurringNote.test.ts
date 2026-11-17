// Under a category with repeating payments in the month's stats: what they are (screens/stats/month/model/recurringNote).
import { recurringNote, recurringNotes } from '../../src/screens/stats/month/model/recurringNote';
import type { PlanItem } from '../../src/db/plans';
import { paymentWords } from '../../src/entities/category/texts';
import { inTime, shortDay } from '../../src/features/recurring-payments/texts';

const T = { words: paymentWords, shortDay: (d: string) => shortDay(d), inTime };

const item = (p: Partial<PlanItem>): PlanItem => ({
  category_id: 1, name: 'Дом и коммуналка', emoji: '🏠', type_id: 1, type_name: 'Жизнь', limit_minor: 80000, currency: 'GEL',
  converted_minor: 80000, kind: 'subs', norm_period: 'month', pinned: false, previous_minor: null, until: null, every: null, weekdays: null,
  unit_minor: null, recurring: true, by_merchant: true, ...p,
} as PlanItem);
const subs = (p: Partial<NonNullable<PlanItem['subs']>>) => ({ names: [], saving_names: [], ...p } as NonNullable<PlanItem['subs']>);

test('its only payment: how often and the next charge once this one is done', () => {
  expect(recurringNote(item({ subs: subs({ single: { period: 1, day: '2026-10-03', done: true } }) }), 'GEL', true, T)).toBe('каждый месяц · следующее 3 ноя');
});

test('a subscription without a day; none at all; all of them in another currency', () => {
  expect(recurringNote(item({ subs: subs({ single: { period: 1, day: null, done: false } }) }), 'GEL', true, T)).toBe('каждый месяц · без даты');
  expect(recurringNote(item({ subs: subs({ empty: true }) }), 'GEL', true, T)).toBe('нет подписок');
  expect(recurringNote(item({ subs: subs({ names: ['Netflix'], in_currency: { currency: 'USD', charges_minor: 1200, saving_minor: 0 } }) }), 'GEL', true, T))
    .toBe('(12 $) · Netflix');
});

test('only the categories with repeating payments get one', () => {
  const notes = recurringNotes([item({ subs: subs({ empty: true }) }), item({ category_id: 2, recurring: false })], 'GEL', true, T);
  expect([...notes.keys()]).toEqual([1]);
});
