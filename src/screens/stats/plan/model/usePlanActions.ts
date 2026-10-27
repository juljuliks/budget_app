// The plan's changes from its screen: the month's budget, an item removed, an item pinned.
import type { UseFormReturn } from 'react-hook-form';
import { categoryLabel } from '@/db/categories';
import { OverBudgetError, PlanItem, removePlanItem, restorePlanItem, setPlanBudget } from '@/db/plans';
import { removeRecurringFrom, restoreRecurring, savedInCategory } from '@/db/recurring';
import { emitTransactionsChanged } from '@/domain/events';
import { MONTHS_GEN } from '@/shared/lib/dates';
import { formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import { AMOUNT_HINT, SAVE_FAILED, UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';
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
    const { unplanned: shareText, currency: cur, locked: lockedText, lockedIsMax } = form.getValues();
    const lockedMinor = parseAmountOrZero(lockedText ?? '');
    const shareMinor = parseAmountOrZero(shareText ?? '');
    if (lockedMinor === null || shareMinor === null) return AMOUNT_HINT;
    // a share right on a stop is kept as a % (it follows the budget), any other as the amount
    const pct = SHARE_STOPS.find((p) => Math.round((minor * p) / 100) === shareMinor);
    try {
      await setPlanBudget(ym, minor === 0 ? null : minor, cur, pct ?? 0, undefined, lockedMinor, pct === undefined ? shareMinor : null, lockedIsMax);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `По категориям уже запланировано ${formatWithCurrency(e.planned_minor, e.currency)} — `
        + (shareMinor || lockedMinor ? 'вместе с отложенным и долей вне плана это больше бюджета.' : 'бюджет не может быть меньше.');
    }
    toast(minor === 0 ? 'Бюджет месяца убран' : 'Бюджет месяца сохранён');
    load();
    return null;
  }

  /** Removed, with "Отменить" in the toast: the item comes back as it was (its amount, 📌, how it is spent). */
  async function remove(item: PlanItem) {
    const label = categoryLabel(item);
    try {
      const row = await removePlanItem(ym, item.category_id);
      toast(`«${label}» убрана из плана`, row ? {
        label: UNDO,
        onPress: () => {
          restorePlanItem(row).then(() => { toast(`«${label}» снова в плане`); load(); })
            .catch(toastFailure('restore plan item', 'Не удалось восстановить'));
        },
      } : undefined);
    } catch (e) {
      console.error('remove plan item failed', e);
      toastError(SAVE_FAILED);
    }
    load();
  }

  /** A category with repeating payments: out of this month's plan and the next ones', its payments off. */
  async function removeRecurring(item: PlanItem) {
    const label = categoryLabel(item);
    try {
      const removed = await removeRecurringFrom(ym, item.category_id);
      emitTransactionsChanged();
      toast(`«${label}» убрана из плана, регулярные платежи выключены`, {
        label: UNDO,
        onPress: () => {
          restoreRecurring(removed).then(() => { emitTransactionsChanged(); toast(`«${label}» снова в плане`); })
            .catch(toastFailure('restore recurring item', 'Не удалось восстановить'));
        },
      });
    } catch (e) {
      console.error('remove recurring item failed', e);
      toastError(SAVE_FAILED);
    }
    load();
  }

  // a category repeated every month is asked about: removing it also stops it carrying over; one with repeating
  // payments — they'd count it again next month: they are turned off, it is gone from the next months too
  async function removeItem(item: PlanItem) {
    if (item.recurring) {
      const saved = await savedInCategory(item.category_id).catch(() => []);
      const kept = saved.length ? ` На платежи уже отложено: ${saved.map((x) => `${x.name} — ${formatWithCurrency(x.minor, x.currency)}`).join(', ')} — это уйдёт в сбережения месяца.` : '';
      sheetAlert(
        `Убрать «${categoryLabel(item)}» из плана?`,
        `У категории регулярные платежи — они выключатся, а категория пропадёт из плана с ${MONTHS_GEN[Number(ym.slice(5)) - 1]}. Операции не изменятся.${kept}`,
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Убрать из плана', style: 'destructive', onPress: () => { removeRecurring(item); } },
        ]);
      return;
    }
    if (!item.pinned) { remove(item); return; }
    sheetAlert(
      `Убрать «${categoryLabel(item)}» из плана?`,
      'Эта категория повторяется каждый месяц. Она пропадёт из плана этого месяца и не перейдёт в следующие. Операции не изменятся.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Убрать из плана', style: 'destructive', onPress: () => { remove(item); } },
      ]);
  }

  return { saveBudget, removeItem };
}
