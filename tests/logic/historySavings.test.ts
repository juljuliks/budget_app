// A month's savings in "История" (screens/stats/history/model/savings.ts).
import type { HistoryMonth } from '../../src/db/plans';
import { monthSavings } from '../../src/screens/stats/history/model/savings';

const month = (m: Partial<HistoryMonth>): HistoryMonth => ({
  ym: '2026-09', planned_minor: 460000, spent_minor: 730400, budget_minor: 1041000,
  locked_minor: 100000, unplanned_minor: 0, close: null, unpaid_fixed_minor: 0, funds_minor: 0, released: [], ...m,
});

test('🔒 and the leftover going to savings: "В сбережения" is both', () => {
  expect(monthSavings(month({}), false)).toMatchObject({
    label: 'В сбережения', total: 310600, pending: false, section: true,
    locked: { plan: 100000, kept: 100000 }, rest: { label: 'Сэкономлено', plan: 481000, value: 210600 },
  });
});

const closed = (rest_choice: 'savings' | 'next' | 'keep', saved_minor: number | null = null) => ({ close: { closed: true, rest_choice, saved_minor } });

test('its "Итоги": the leftover kept as is — "Сэкономлено", the section still there for 🔒; none — no section', () => {
  expect(monthSavings(month(closed('keep')), false)).toMatchObject({ label: 'Сэкономлено', total: 310600, section: true, open: false });
  expect(monthSavings(month({ ...closed('keep'), locked_minor: 0 }), false)).toMatchObject({ label: 'Сэкономлено', section: false });
});

test('its "Итоги": the leftover moved — "Перенесено" is the leftover (🔒 stays); put aside less — what was', () => {
  expect(monthSavings(month(closed('next')), false)).toMatchObject({ label: 'Перенесено', total: 310600, value: 210600 });
  expect(monthSavings(month(closed('savings', 250000)), false)).toMatchObject({ label: 'В сбережения', value: 250000, saved: 250000 });
});

test('a month over not closed: "Итоги не подведены", the leftover counted as going to savings', () => {
  expect(monthSavings(month({ close: { closed: false, rest_choice: null, saved_minor: null } }), false))
    .toMatchObject({ label: 'В сбережения', open: true, value: 310600 });
});

test('the spending took part of 🔒, then went past the budget', () => {
  expect(monthSavings(month({ spent_minor: 981000 }), false)).toMatchObject({
    total: 60000, locked: { plan: 100000, kept: 60000 }, rest: { label: 'Сэкономлено', value: 0 },
  });
  expect(monthSavings(month({ spent_minor: 1073000 }), false)).toMatchObject({
    label: 'Перерасход бюджета', total: -32000, locked: { kept: 0 }, rest: { label: 'Сверх бюджета', value: -32000 },
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

test('"Сверх бюджета" has no plan; what the plan left under a unit (the rates\' dust) is none either', () => {
  // the plan left 0.02: everything but it planned, 🔒 or the share
  const dust = { planned_minor: 940998, locked_minor: 100000 };
  expect(monthSavings(month({ ...dust, spent_minor: 1073000 }), false)!.rest).toMatchObject({ label: 'Сверх бюджета', plan: null });
  expect(monthSavings(month(dust), false)!.rest).toMatchObject({ label: 'Сэкономлено', plan: null });
});
