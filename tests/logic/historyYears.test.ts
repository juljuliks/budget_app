// «История по месяцам» by years (screens/stats/history/model/yearMonths.ts).
import { historyYears, yearMonths } from '../../src/screens/stats/history/model/yearMonths';
import type { HistoryMonth } from '../../src/db/plans';

const m = (ym: string) => ({ ym }) as HistoryMonth;

test("a year's 12 months, the newest first: the data, «впереди», «нет операций»", () => {
  const rows = yearMonths([m('2026-11'), m('2026-10'), m('2026-09')], 2026, '2026-11');
  expect(rows.map((r) => [r.ym, r.state])).toEqual([
    ['2026-12', 'future'],
    ['2026-11', 'data'],
    ['2026-10', 'data'],
    ['2026-09', 'data'],
    ...['08', '07', '06', '05', '04', '03', '02', '01'].map((x) => [`2026-${x}`, 'none']),
  ]);
});

test("the years: from the first month's to the current one", () => {
  expect(historyYears([m('2026-01'), m('2025-11')], 2026)).toEqual([2026, 2025]);
  expect(historyYears([], 2026)).toEqual([2026]);
});
