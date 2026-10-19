// The plan's writes from its sheets: each one tells the screens (the stats, the reports) the data changed.
import { deleteFund, getFund, restoreFund, setFund, setPlanAmount } from '@/db/plans';
import type { Currency } from '@/db/fx';
import { getCategory } from '@/db/categories';
import { categoryPayment, savePayment, turnRecurring } from '@/db/recurring';
import { emitTransactionsChanged } from '@/domain/events';

/**
 * A category's amount in a month's plan (added to it if it wasn't there); throws OverBudgetError past the budget. A fund
 * made a limit or a payment stops being a fund (what it saved goes to this month's savings).
 */
export async function savePlanAmount(...args: Parameters<typeof setPlanAmount>) {
  const fund = await getFund(args[1]);
  const deleted = fund && !fund.closed_ym ? await deleteFund(args[1]) : null;
  try {
    await setPlanAmount(...args);
  } catch (e) {
    // not saved (over the budget): the fund stays as it was
    if (deleted) await restoreFund(deleted);
    throw e;
  }
  emitTransactionsChanged();
}

/** The category made a fund (or the fund changed) from the month; throws OverBudgetError if its contribution doesn't fit. */
export async function saveFund(...args: Parameters<typeof setFund>) {
  await setFund(...args);
  emitTransactionsChanged();
}

/**
 * "Повторяющийся платёж" from the plan's sheet: the category's payment without a merchant (charged by any of its
 * spending), the category's repeating payments on. Without a day the amount stands in the plan each month (by hand).
 */
export async function saveRecurring(ym: string, categoryId: number, p: { amount_minor: number; currency: Currency; period: number; due: string | null }) {
  const fund = await getFund(categoryId);
  if (fund && !fund.closed_ym) await deleteFund(categoryId);
  const c = await getCategory(categoryId);
  const own = await categoryPayment(categoryId);
  await savePayment({ category_id: categoryId, merchant_key: null, name: c?.name ?? '', ...p }, own?.id);
  if (!p.due) await setPlanAmount(ym, categoryId, p.amount_minor, 'fixed', p.currency);
  await turnRecurring(categoryId, true);
  emitTransactionsChanged();
}

/** The category's repeating payments off (what they saved goes to this month's savings). */
export async function stopRecurring(categoryId: number): Promise<void> {
  await turnRecurring(categoryId, false);
  emitTransactionsChanged();
}
