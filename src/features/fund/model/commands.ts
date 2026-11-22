// A fund made or changed on its category's page; turned off: asked first, what it saved goes to this month's savings,
// "Отменить" in the toast puts it back.
import { currentYm, deleteFund, FundInput, fundThisMonth, restoreFund, setFund } from '@/db/plans';
import { emitTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { dayTitle, MONTHS_GEN } from '@/shared/lib/dates';
import { SAVE_FAILED, UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';

/** "сбережения октября": the savings of the month the fund is deleted in. */
const thisMonthSavings = (now = new Date()) => `сбережения ${MONTHS_GEN[now.getMonth()]}`;
const savingsOf = (ym?: string) => ym ? `сбережения ${MONTHS_GEN[Number(ym.slice(5)) - 1]}` : thisMonthSavings();

async function remove(categoryId: number, label: string, onDone: () => void, ym?: string) {
  try {
    const deleted = await deleteFund(categoryId, ym);
    emitTransactionsChanged();
    onDone();
    toast(`Копилка «${label}» выключена`, deleted ? {
      label: UNDO,
      onPress: () => {
        restoreFund(deleted).then(() => { emitTransactionsChanged(); toast(`Копилка «${label}» снова в плане`); })
          .catch(toastFailure('restore fund', 'Не удалось восстановить'));
      },
    } : undefined);
  } catch (e) {
    console.error('delete fund failed', e);
    toastError(SAVE_FAILED);
  }
}

/** Saved from its category's page («Настроить»): from this month, its contribution fitted to the budget by itself. */
export function saveCategoryFund(categoryId: number, label: string, input: FundInput, onDone?: () => void) {
  setFund(currentYm(), categoryId, input)
    .then(() => { emitTransactionsChanged(); toast(`Копилка «${label}» сохранена`); onDone?.(); })
    .catch(toastFailure('save fund', SAVE_FAILED));
}

/** Another kind picked for a fund's category: "Выключить копилку?" (what it has goes to the month's savings); none open — `onDone` at once. */
export async function askFundOff(categoryId: number, label: string, onDone: () => void) {
  const m = await fundThisMonth(categoryId);
  if (!m) { onDone(); return; }
  confirmDeleteFund(categoryId, label, m.saved, m.fund.currency, onDone);
}

/**
 * "Выключить копилку «🏖 Отпуск»?": what it has goes to the savings of `ym` (or the current month).
 * Pass `ym` when deleting from a past month's plan so the item is removed from that month too.
 */
export function confirmDeleteFund(categoryId: number, label: string, saved: number, currency: string, onDone: () => void, ym?: string) {
  sheetAlert(
    `Выключить копилку «${label}»?`,
    `${saved > 0 ? `Накоплено ${formatWithCurrency(saved, currency)} — они уйдут в ${savingsOf(ym)}. ` : ''}`
      + 'Траты категории снова будут из бюджета месяца, взноса в плане больше не будет.',
    [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выключить', style: 'destructive', onPress: () => { remove(categoryId, label, onDone, ym); } },
    ]);
}

/**
 * Not making it by its date: «Сдвинуть на 30 сентября 2027» (a later date) or «Копить 1 185 $ к 31 июля» (a smaller sum) —
 * saved at once, «Отменить» in the toast puts back what it was.
 */
export function changeFundGoal(categoryId: number, label: string, was: FundInput, now: Partial<Pick<FundInput, 'due' | 'target_minor'>>) {
  const done = now.due ? `Копилка «${label}» — к ${dayTitle(now.due)}` : `Копилка «${label}» — ${formatWithCurrency(now.target_minor ?? 0, was.currency)}`;
  setFund(currentYm(), categoryId, { ...was, ...now })
    .then(() => {
      emitTransactionsChanged();
      toast(done, {
        label: UNDO,
        onPress: () => { setFund(currentYm(), categoryId, was).then(emitTransactionsChanged).catch(toastFailure('restore fund goal', 'Не удалось восстановить')); },
      });
    })
    .catch(toastFailure('save fund goal', SAVE_FAILED));
}
