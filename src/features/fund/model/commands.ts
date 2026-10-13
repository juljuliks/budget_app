// A fund deleted: asked first; what it saved goes to this month's savings; "Отменить" in the toast puts it back.
import { deleteFund, restoreFund } from '@/db/plans';
import { emitTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { MONTHS_GEN } from '@/shared/lib/dates';
import { SAVE_FAILED, UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';

/** "сбережения октября": the current month's savings. */
const thisMonthSavings = (now = new Date()) => `сбережения ${MONTHS_GEN[now.getMonth()]}`;

async function remove(categoryId: number, label: string, onDone: () => void) {
  try {
    const deleted = await deleteFund(categoryId);
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

/** "Удалить копилку «🏖 Отпуск»?": what it has goes to this month's savings, the category stays (outside the plan). */
export function confirmDeleteFund(categoryId: number, label: string, saved: number, currency: string, onDone: () => void) {
  sheetAlert(
    `Удалить копилку «${label}»?`,
    `${saved > 0 ? `Накоплено ${formatWithCurrency(saved, currency)} — они перейдут в ${thisMonthSavings()}. ` : ''}`
      + 'Категория останется, её траты пойдут вне плана, пока вы не добавите её в план снова.',
    [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => { remove(categoryId, label, onDone); } },
    ]);
}
