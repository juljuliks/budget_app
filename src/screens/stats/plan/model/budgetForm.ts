import type { Currency } from '@/db/fx';
import type { PlanBudget } from '@/db/plans';

/** The budget sheet: the amount and its currency, the share outside the plan (🔒 — by the settings' %, where the leftover goes — «Итоги месяца»). */
export type BudgetForm = { value: string; currency: Currency; unplanned: string };

/** the slider's stops, % of the budget */
export const SHARE_STOPS = [0, 10, 20, 30, 40, 50];

/**
 * «🔒 Отложить сразу» of the amount being typed: by the month's % (a month without a budget yet — the settings'), less
 * what was taken from it this month; an old month's amount of its own as it is; neither — not set.
 */
export type LockedOfForm =
  | { kind: 'pct'; pct: number; full: number; taken: number; funds: boolean; locked: number }
  | { kind: 'amount'; locked: number }
  | { kind: 'none'; locked: 0 };

export function lockedOfForm(budget: PlanBudget | null, setting: number | null, amount: number): LockedOfForm {
  const pct = budget ? budget.locked_pct : setting;
  if (pct !== null) {
    const full = Math.round((amount * pct) / 100);
    const taken = budget?.locked_taken_minor ?? 0;
    return { kind: 'pct', pct, full, taken, funds: !!budget && budget.locked_funds_minor >= taken, locked: Math.max(0, full - taken) };
  }
  if (budget && budget.locked_minor > 0) return { kind: 'amount', locked: budget.locked_minor };
  return { kind: 'none', locked: 0 };
}
