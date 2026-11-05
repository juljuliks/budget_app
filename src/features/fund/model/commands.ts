// A fund deleted: asked first; what it saved goes to this month's savings; "Отменить" in the toast puts it back.
import { deleteFund, restoreFund } from '@/db/plans';
import { emitTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { MONTHS_GEN } from '@/shared/lib/dates';
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
    toast(`Копилка «${label}» удалена`, deleted ? {
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

/**
 * "Удалить копилку «🏖 Отпуск»?": what it has goes to the savings of `ym` (or the current month).
 * Pass `ym` when deleting from a past month's plan so the item is removed from that month too.
 */
export function confirmDeleteFund(categoryId: number, label: string, saved: number, currency: string, onDone: () => void, ym?: string) {
  sheetAlert(
    `Удалить копилку «${label}»?`,
    `${saved > 0 ? `Накоплено ${formatWithCurrency(saved, currency)} — они перейдут в ${savingsOf(ym)}. ` : ''}`
      + 'Категория останется, её траты пойдут вне плана, пока вы не добавите её в план снова.',
    [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => { remove(categoryId, label, onDone, ym); } },
    ]);
}
