// The plan's writes from its sheets: each one tells the screens (the stats, the reports) the data changed.
import { RegularItem, setPlanAmount, setRegularItem, setUndatedAhead } from '@/db/plans';
import type { Currency } from '@/db/fx';
import { getCategory } from '@/db/categories';
import { categoryPayment, savePayment, startSaving, stopSaving, turnRecurring } from '@/db/recurring';
import type { SavingChoice } from './usePaymentSaving';
import { emitTransactionsChanged } from '@/domain/events';

/** A category's amount in a month's plan (added to it if it wasn't there); throws OverBudgetError past the budget. */
export async function savePlanAmount(...args: Parameters<typeof setPlanAmount>) {
  await setPlanAmount(...args);
  emitTransactionsChanged();
}

/** A regular payment within the month (every day, on weekdays); throws OverBudgetError past the budget. */
export async function saveRegular(ym: string, categoryId: number, r: RegularItem, currency: Currency, takeLocked: boolean | 'all' = false) {
  await setRegularItem(ym, categoryId, r, currency, takeLocked);
  emitTransactionsChanged();
}

/**
 * A regular payment, monthly or rarer: the category's own payment (its charges are its days), its regular payments on;
 * rarer — saved up for from now ("Откладывать каждый месяц?") or not any more (what it had goes to this month's savings).
 */
export async function saveCategoryPayment(
  ym: string, categoryId: number, p: { amount_minor: number; currency: Currency; period: number; due: string | null; until: string | null; saving?: SavingChoice | null },
) {
  // without a day: the amount by hand in the plan, each month (carried over with it); past the budget — OverBudgetError
  // before anything else is changed
  if (!p.due) {
    await setPlanAmount(ym, categoryId, p.amount_minor, 'fixed', p.currency);
    // the coming months' items counted from its charges (it had a day): by hand too, or they'd count none
    await setUndatedAhead(ym, categoryId, p.amount_minor, p.currency);
  }
  const c = await getCategory(categoryId);
  const own = await categoryPayment(categoryId);
  const { saving, ...payment } = p;
  const id = await savePayment({ category_id: categoryId, merchant_key: null, name: c?.name ?? '', ...payment }, own?.id);
  const on = !!saving?.on && !!p.due;
  if (on && !saving!.had) await startSaving(id, saving!.start);
  if (!on && saving?.had) await stopSaving(id);
  emitTransactionsChanged();
}

/** The category's subscriptions in the plan again (its item counted from their charges). */
export async function resumeSubscriptions(categoryId: number): Promise<void> {
  await turnRecurring(categoryId, true);
  emitTransactionsChanged();
}

/** The category's repeating payments off (what they saved goes to this month's savings). */
export async function stopRecurring(categoryId: number): Promise<void> {
  await turnRecurring(categoryId, false);
  emitTransactionsChanged();
}
