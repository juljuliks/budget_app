// The reports as stories only while fresh (stats/reportWindow.ts).
import { freshMonth, freshYear, isMonthFresh, isYearFresh } from '../../src/stats/reportWindow';

const at = (s: string) => new Date(`${s}T12:00:00`);

test('a month\'s report: from the 24th of it to the 7th of the next; between them — none', () => {
  expect(freshMonth(at('2026-10-23'))).toBeNull();
  expect(freshMonth(at('2026-10-24'))).toEqual({ ym: '2026-10', daysLeft: 14 });
  expect(freshMonth(at('2026-10-31'))).toEqual({ ym: '2026-10', daysLeft: 7 });
  expect(freshMonth(at('2026-11-01'))).toEqual({ ym: '2026-10', daysLeft: 6 });
  expect(freshMonth(at('2026-11-07'))).toEqual({ ym: '2026-10', daysLeft: 0 });
  expect(freshMonth(at('2026-11-08'))).toBeNull();
  expect(freshMonth(at('2027-01-03'))).toEqual({ ym: '2026-12', daysLeft: 4 });
  expect(isMonthFresh('2026-10', at('2026-11-03'))).toBe(true);
  expect(isMonthFresh('2026-09', at('2026-11-03'))).toBe(false);
});

test('the year\'s: 24 December — 7 January', () => {
  expect(freshYear(at('2026-12-23'))).toBeNull();
  expect(freshYear(at('2026-12-24'))).toEqual({ year: 2026, daysLeft: 14 });
  expect(freshYear(at('2027-01-07'))).toEqual({ year: 2026, daysLeft: 0 });
  expect(freshYear(at('2027-01-08'))).toBeNull();
  expect(isYearFresh(2026, at('2027-01-02'))).toBe(true);
  expect(isYearFresh(2025, at('2027-01-02'))).toBe(false);
});
