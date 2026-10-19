// A repeating payment's charges past what is free in the plan: what is short, taken from "🔒 Отложить сразу" if asked.
import { getDb } from '../index';
import { Currency } from '../fx';
import { planConverter, plannedTotal, storedBudget } from './budget';

type Short = { short: number; locked: number; currency: Currency };

/**
 * `delta` (in the budget's currency) more in `ym`'s plan, and a repeating payment's new contribution (in its own
 * currency): what it is short of the free part and what 🔒 has. null — it fits, or the month has no budget.
 */
export async function recurringShort(ym: string, delta: number, contribution?: { minor: number; currency: Currency }): Promise<Short | null> {
  const budget = await storedBudget(ym);
  if (!budget) return null;
  const saving = contribution?.minor ? (await planConverter(ym))(contribution.minor, contribution.currency, budget.currency) ?? 0 : 0;
  if (delta + saving <= 0) return null;
  const short = (await plannedTotal(ym, undefined, budget.currency)) + delta + saving - budget.plannable_minor;
  return short > 0 ? { short, locked: budget.locked_minor, currency: budget.currency } : null;
}

/**
 * A category's plan item in `ym` to become `minor` (in `currency`): what it is short of the free part and what 🔒 has.
 * null — it fits, it isn't more than it was, or the month has no budget.
 */
export async function itemShort(ym: string, categoryId: number, minor: number, currency: Currency): Promise<Short | null> {
  const budget = await storedBudget(ym);
  if (!budget) return null;
  const others = await plannedTotal(ym, categoryId, budget.currency);
  const delta = others + ((await planConverter(ym))(minor, currency, budget.currency) ?? 0) - (await plannedTotal(ym, undefined, budget.currency));
  return recurringShort(ym, delta);
}

/** "Вычесть из сбережений": `short` less locked for savings in `ym`. */
export async function takeLocked(ym: string, short: number): Promise<void> {
  await (await getDb()).run('UPDATE plan_months SET locked_minor = max(0, locked_minor - ?) WHERE ym = ?', [short, ym]);
}
