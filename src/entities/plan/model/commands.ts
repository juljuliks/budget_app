// The plan's writes from its sheets: each one tells the screens (the stats, the reports) the data changed.
import { deleteFund, getFund, RegularItem, restoreFund, setFund, setPlanAmount, setRegularItem } from '@/db/plans';
import type { Currency } from '@/db/fx';
import { turnRecurring } from '@/db/recurring';
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

/** The category's repeating payments off (what they saved goes to this month's savings). */
export async function stopRecurring(categoryId: number): Promise<void> {
  await turnRecurring(categoryId, false);
  emitTransactionsChanged();
}
