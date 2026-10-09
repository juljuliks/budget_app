// The shared calendar words and the percent: one copy each, used by the texts of the stats, the plan and the alerts.
import { MONTHS_GEN, MONTHS_NOM, MONTHS_PREP, RHYTHM_DAYS, SHORT_MONTHS, WEEKDAYS, monthTitle } from '../../src/shared/lib/dates';
import { formatPercent } from '../../src/shared/lib/format';

test('the months in each case, the weekdays by getDay()', () => {
  for (const list of [MONTHS_NOM, MONTHS_GEN, MONTHS_PREP, SHORT_MONTHS]) expect(list).toHaveLength(12);
  expect([MONTHS_NOM[4], MONTHS_GEN[4], MONTHS_PREP[4], SHORT_MONTHS[4]]).toEqual(['май', 'мая', 'мае', 'мая']);
  expect(monthTitle(2026, 9)).toBe('Октябрь 2026');
  // 15.10.2026 is a Thursday
  expect(WEEKDAYS[new Date(2026, 9, 15).getDay()]).toBe('чт');
  expect(RHYTHM_DAYS).toEqual({ day: 1, week: 7, '2weeks': 14 });
});

test.each([
  [50, 200, '25%'], [1, 1000, '<1%'], [0, 100, '0%'], [5, 0, '<1%'], [0, 0, '0%'], [300, 200, '150%'],
])('formatPercent(%p, %p) = %p', (part, whole, expected) => {
  expect(formatPercent(part, whole)).toBe(expected);
});
