// The plan's writes from its sheets: each one tells the screens (the stats, the reports) the data changed.
import { deleteFund, getFund, restoreFund, setFund, setPlanAmount } from '@/db/plans';
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
