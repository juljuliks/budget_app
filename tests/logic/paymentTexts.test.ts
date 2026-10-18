// The subscriptions' words (features/recurring-payments/texts.ts, periodText in shared/lib/format.ts).
import { periodText } from '../../src/shared/lib/format';
import { inMonth, inTime, longDay, monthGenYear, shortDay } from '../../src/features/recurring-payments/texts';

test('how often', () => {
  expect([1, 3, 6, 12, 24, 5, 2].map(periodText)).toEqual(
    ['каждый месяц', 'раз в 3 месяца', 'раз в полгода', 'раз в год', 'раз в 2 года', 'раз в 5 месяцев', 'раз в 2 месяца']);
});

test('when: "сегодня", "завтра", days under four weeks, then months; past — none', () => {
  expect(inTime('2026-10-15', '2026-10-15')).toBe('сегодня');
  expect(inTime('2026-10-16', '2026-10-15')).toBe('завтра');
  expect(inTime('2026-10-25', '2026-10-15')).toBe('через 10 дней');
  expect(inTime('2026-11-10', '2026-10-15')).toBe('через 26 дней');
  expect(inTime('2026-11-18', '2026-10-18')).toBe('через месяц');
  expect(inTime('2027-03-12', '2026-10-18')).toBe('через 5 месяцев');
  expect(inTime('2026-10-14', '2026-10-15')).toBeNull();
});

test('days and months', () => {
  const now = new Date(2026, 9, 18);
  expect(shortDay('2026-10-25', now)).toBe('25 окт');
  expect(shortDay('2027-03-12', now)).toBe('12 мар 2027');
  expect(longDay('2026-11-18')).toBe('18 ноября');
  expect(inMonth('2027-06')).toBe('в июне');
  expect(monthGenYear('2026-11', now)).toBe('ноября');
  expect(monthGenYear('2027-09', now)).toBe('сентября 2027');
});
