// A month's savings in "История" (screens/stats/history/model/savings.ts).
import type { HistoryMonth } from '../../src/db/plans';
import { monthSavings } from '../../src/screens/stats/history/model/savings';

const month = (m: Partial<HistoryMonth>): HistoryMonth => ({
  ym: '2026-09', planned_minor: 460000, spent_minor: 730400, budget_minor: 1041000,
  locked_minor: 100000, unplanned_minor: 0, to_savings: true, unpaid_fixed_minor: 0, ...m,
});

test('🔒 and the leftover going to savings: "В сбережения" is both', () => {
  expect(monthSavings(month({}), false)).toMatchObject({
    label: 'В сбережения', total: 310600, pending: false, section: true,
    locked: { plan: 100000, kept: 100000 }, rest: { label: 'Что осталось', plan: 481000, value: 210600 },
  });
});

test('only 🔒: "Сэкономлено", the whole of it, the section still there', () => {
  expect(monthSavings(month({ to_savings: false }), false)).toMatchObject({ label: 'Сэкономлено', total: 310600, section: true });
});

test('no savings in the plan: "Сэкономлено", no section', () => {
  expect(monthSavings(month({ to_savings: false, locked_minor: 0 }), false)).toMatchObject({ label: 'Сэкономлено', section: false });
});

test('the spending took part of 🔒, then went past the budget', () => {
  expect(monthSavings(month({ spent_minor: 981000 }), false)).toMatchObject({
    total: 60000, locked: { plan: 100000, kept: 60000 }, rest: { label: 'Что осталось', value: 0 },
  });
  expect(monthSavings(month({ spent_minor: 1073000 }), false)).toMatchObject({
    label: 'Перерасход', total: -32000, locked: { kept: 0 }, rest: { label: 'Сверх бюджета', value: -32000 },
  });
});

test('the current month: "пока", the obligatory payments not paid yet are not leftover', () => {
  expect(monthSavings(month({ spent_minor: 241288, unpaid_fixed_minor: 143900 }), true)).toMatchObject({
    pending: true, total: 1041000 - 241288 - 143900, unpaidFixed: 143900,
  });
  // a past month: whatever was planned, it's over
  expect(monthSavings(month({ unpaid_fixed_minor: 143900 }), false)).toMatchObject({ total: 310600 });
});

test('no budget: nothing', () => {
  expect(monthSavings(month({ budget_minor: null }), false)).toBeNull();
});
