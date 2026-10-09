// The plan's changes from its screen: the month's budget, an item removed, an item pinned.
import type { UseFormReturn } from 'react-hook-form';
import { categoryLabel } from '@/db/categories';
import { OverBudgetError, PlanItem, removePlanItem, setPlanBudget, setPlanPinned } from '@/db/plans';
import { formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import { AMOUNT_HINT } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { BudgetForm, SHARE_STOPS } from './budgetForm';

export function usePlanActions(ym: string, load: () => void) {
  /** A change of the plan, then `done` in a toast. */
  async function run(action: Promise<unknown>, done: string) {
    try {
      await action;
      toast(done);
    } catch (e) {
      console.error('plan update failed', e);
      toastError('Не удалось сохранить');
    }
    load();
  }

  /** Saves the amount to distribute (0 / empty = not set); returns an error to show in the dialog, or null. */
  async function saveBudget(text: string, form: UseFormReturn<BudgetForm>): Promise<string | null> {
    const minor = parseAmountOrZero(text);
    if (minor === null) return AMOUNT_HINT;
    const { unplanned: shareText, toSavings: savings, currency: cur, locked: lockedText } = form.getValues();
    const lockedMinor = parseAmountOrZero(lockedText ?? '');
    const shareMinor = parseAmountOrZero(shareText ?? '');
    if (lockedMinor === null || shareMinor === null) return AMOUNT_HINT;
    // a share right on a stop is kept as a % (it follows the budget), any other as the amount
    const pct = SHARE_STOPS.find((p) => Math.round((minor * p) / 100) === shareMinor);
    try {
      await setPlanBudget(ym, minor === 0 ? null : minor, cur, pct ?? 0, savings, lockedMinor, pct === undefined ? shareMinor : null);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `По категориям уже запланировано ${formatWithCurrency(e.planned_minor, e.currency)} — `
        + (shareMinor || lockedMinor ? 'вместе с отложенным и долей вне плана это больше бюджета.' : 'бюджет не может быть меньше.');
    }
    toast(minor === 0 ? 'Бюджет месяца убран' : 'Бюджет месяца сохранён');
    load();
    return null;
  }

  // a category repeated every month (📌) is asked about: removing it also stops it carrying over
  function removeItem(item: PlanItem) {
    const done = `«${categoryLabel(item)}» убрана из плана`;
    if (!item.pinned) { run(removePlanItem(ym, item.category_id), done); return; }
    sheetAlert(
      `Убрать «${categoryLabel(item)}» из плана?`,
      'Эта категория повторяется каждый месяц (📌). Она пропадёт из плана этого месяца и не перейдёт в следующие. Операции не изменятся.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Убрать из плана', style: 'destructive', onPress: () => { run(removePlanItem(ym, item.category_id), done); } },
      ]);
  }

  function togglePin(item: PlanItem) {
    run(setPlanPinned(ym, item.category_id, !item.pinned),
      item.pinned ? `«${categoryLabel(item)}» больше не повторяется` : `«${categoryLabel(item)}» будет повторяться каждый месяц`);
  }

  return { saveBudget, removeItem, togglePin };
}
