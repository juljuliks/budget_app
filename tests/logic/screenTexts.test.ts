// Small texts of the screens: a merchant's purchases (screens/merchants), a new operation's day (features/add-transaction).
import { activityText, shortDate } from '../../src/screens/merchants/model/activity';
import { dayLabel } from '../../src/features/add-transaction/model/dayLabel';

const now = new Date(2026, 9, 15, 12);
const unix = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime() / 1000;

test('a date: no year this year', () => {
  expect(shortDate(unix(2026, 4, 12), now)).toBe('12 мая');
  expect(shortDate(unix(2025, 4, 12), now)).toBe('12 мая 2025');
});

test('a merchant\'s purchases: lately, or all of them with their dates', () => {
  const totals = [{ currency: 'GEL', amount_minor: 4520 }];
  expect(activityText({ count: 0, totals: [], recent: false, from: 0, to: 0 } as never, now)).toBe('Покупок нет');
  expect(activityText({ count: 3, totals, recent: true, from: 0, to: 0 } as never, now)).toBe('За последний месяц: 3 покупки на 45.20 ₾');
  expect(activityText({ count: 5, totals, recent: false, from: unix(2026, 4, 12), to: unix(2026, 7, 20) } as never, now))
    .toBe('5 покупок на 45.20 ₾ · 12 мая – 20 авг');
});

test('a new operation\'s day: today, yesterday, a date, another year', () => {
  expect(dayLabel('2026-10-15', now)).toBe('Сегодня, 15 октября');
  expect(dayLabel('2026-10-14', now)).toBe('Вчера, 14 октября');
  expect(dayLabel('2026-09-28', now)).toBe('28 сентября');
  expect(dayLabel('2025-09-28', now)).toBe('28 сентября 2025');
});
