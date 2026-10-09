// The plan's writes from its sheets: each one tells the screens (the stats, the reports) the data changed.
import { setPlanAmount } from '@/db/plans';
import { emitTransactionsChanged } from '@/events';

/** A category's amount in a month's plan (added to it if it wasn't there); throws OverBudgetError past the budget. */
export async function savePlanAmount(...args: Parameters<typeof setPlanAmount>) {
  await setPlanAmount(...args);
  emitTransactionsChanged();
}
