// The budget sheet's «ОТЛОЖИТЬ СРАЗУ» of the amount being typed (screens/stats/plan/model/budgetForm.ts).
import { lockedOfForm } from '../../src/screens/stats/plan/model/budgetForm';
import type { PlanBudget } from '../../src/db/plans';

const budget = (b: Partial<PlanBudget>): PlanBudget => ({
  amount_minor: 200000, currency: 'USD', unplanned_pct: 0, unplanned_minor: null, unplanned_cover_minor: 0, locked_minor: 30000,
  locked_pct: 15, locked_taken_minor: 0, locked_funds_minor: 0, plannable_minor: 170000, to_savings: true, carry: null, ...b,
});

test('by the month\'s %: of the amount typed, less what was taken; by whom', () => {
  expect(lockedOfForm(budget({}), 20, 300000)).toEqual({ kind: 'pct', pct: 15, full: 45000, taken: 0, funds: true, locked: 45000 });
  expect(lockedOfForm(budget({ locked_taken_minor: 3500, locked_funds_minor: 3500 }), null, 200000))
    .toMatchObject({ full: 30000, taken: 3500, funds: true, locked: 26500 });
  expect(lockedOfForm(budget({ locked_taken_minor: 3500, locked_funds_minor: 0 }), null, 200000)).toMatchObject({ funds: false });
  // more taken than the % gives: nothing left
  expect(lockedOfForm(budget({ locked_taken_minor: 40000 }), null, 200000).locked).toBe(0);
});

test('no budget yet: the settings\' %; an old month\'s amount of its own; neither — not set', () => {
  expect(lockedOfForm(null, 10, 300000)).toMatchObject({ kind: 'pct', pct: 10, locked: 30000 });
  expect(lockedOfForm(budget({ locked_pct: null, locked_minor: 50000 }), 10, 300000)).toEqual({ kind: 'amount', locked: 50000 });
  expect(lockedOfForm(budget({ locked_pct: null, locked_minor: 0 }), null, 300000)).toEqual({ kind: 'none', locked: 0 });
  expect(lockedOfForm(null, null, 300000)).toEqual({ kind: 'none', locked: 0 });
});
