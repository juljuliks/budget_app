// A repeating payment's charges past what is free in the plan: what is short, taken from "🔒 Отложить сразу" if asked.
import { getDb } from '../index';
import { Currency } from '../fx';
import { plannedTotal, storedBudget } from './budget';

/**
 * `delta` (in the budget's currency) more for "Подписки" in `ym`: what it is short of the free part and what 🔒 has.
 * null — it fits, or the month has no budget.
 */
export async function recurringShort(ym: string, delta: number): Promise<{ short: number; locked: number; currency: Currency } | null> {
  const budget = await storedBudget(ym);
  if (!budget || delta <= 0) return null;
  const short = (await plannedTotal(ym, undefined, budget.currency)) + delta - budget.plannable_minor;
  return short > 0 ? { short, locked: budget.locked_minor, currency: budget.currency } : null;
}

/** "Вычесть из сбережений": `short` less locked for savings in `ym`. */
export async function takeLocked(ym: string, short: number): Promise<void> {
  await (await getDb()).run('UPDATE plan_months SET locked_minor = max(0, locked_minor - ?) WHERE ym = ?', [short, ym]);
}
