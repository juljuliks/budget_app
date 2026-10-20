// The plan's writes from its sheets: each one tells the screens (the stats, the reports) the data changed.
import { deleteFund, getFund, RegularItem, restoreFund, setFund, setPlanAmount, setRegularItem } from '@/db/plans';
import type { Currency } from '@/db/fx';
import { getCategory, setByMerchant } from '@/db/categories';
import { categoryPayment, deletePayment, paymentsOfCategory, savePayment, turnRecurring } from '@/db/recurring';
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

/** A regular payment within the month (every day, on weekdays); throws OverBudgetError past the budget. A fund stops being one. */
export async function saveRegular(ym: string, categoryId: number, r: RegularItem, currency: Currency, takeLocked = false) {
  const fund = await getFund(categoryId);
  if (fund && !fund.closed_ym) await deleteFund(categoryId);
  await setRegularItem(ym, categoryId, r, currency, takeLocked);
  emitTransactionsChanged();
}

/** The category made a fund (or the fund changed) from the month; throws OverBudgetError if its contribution doesn't fit. */
export async function saveFund(...args: Parameters<typeof setFund>) {
  await setFund(...args);
  emitTransactionsChanged();
}

/**
 * "Траты категории", monthly or rarer: the category's own payment (any of its spending around the day is the charge), its
 * regular payments on; merchants' payments it had — gone first (asked in the sheet).
 */
export async function saveCategoryPayment(
  ym: string, categoryId: number, p: { amount_minor: number; currency: Currency; period: number; due: string | null; until: string | null },
) {
  // without a day: the amount by hand in the plan, each month (carried over with it); past the budget — OverBudgetError
  // before anything else is changed
  if (!p.due) await setPlanAmount(ym, categoryId, p.amount_minor, 'fixed', p.currency);
  const fund = await getFund(categoryId);
  if (fund && !fund.closed_ym) await deleteFund(categoryId);
  await dropPayments(categoryId, true);
  const c = await getCategory(categoryId);
  const own = await categoryPayment(categoryId);
  await savePayment({ category_id: categoryId, merchant_key: null, name: c?.name ?? '', ...p }, own?.id);
  await setByMerchant(categoryId, false);
  emitTransactionsChanged();
}

/** The category's merchants' payments (`merchants`) or its own one deleted (what they saved goes to this month's savings). */
async function dropPayments(categoryId: number, merchants: boolean) {
  for (const s of await paymentsOfCategory(categoryId)) {
    if (!!s.merchant_key === merchants) await deletePayment(s.id);
  }
}

/** The category's repeating payments off (what they saved goes to this month's savings). */
export async function stopRecurring(categoryId: number): Promise<void> {
  await turnRecurring(categoryId, false);
  emitTransactionsChanged();
}
