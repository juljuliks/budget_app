import { savedInCategory } from '@/db/recurring';
import { formatWithCurrency } from '@/shared/lib/money';
import { UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastFailure } from '@/shared/ui/toast';
import { stopRecurring, undoStopRecurring } from '../model/commands';

/** "Выключить повторяющиеся платежи?" when they saved something (it goes to this month's savings); true — go on. */
export async function askTurnOff(categoryId: number): Promise<boolean> {
  const saved = await savedInCategory(categoryId);
  if (!saved.length) return true;
  const list = saved.map((x) => `${x.name} — ${formatWithCurrency(x.minor, x.currency)}`).join(', ');
  return new Promise((resolve) => {
    sheetAlert(
      'Выключить повторяющиеся платежи?',
      `На платежи уже отложено: ${list}. Это уйдёт в сбережения месяца — как при удалении копилки.`,
      [{ text: 'Отмена', style: 'cancel', onPress: () => resolve(false) }, { text: 'Выключить', style: 'destructive', onPress: () => resolve(true) }]);
  });
}

/**
 * The plan's "Выключить повторяющиеся платежи" (or another kind picked for such a category: `quiet`, its save tells):
 * asked if they saved something, then off, "Отменить" in the toast; false — not turned off.
 */
export async function turnOffRecurring(categoryId: number, quiet = false): Promise<boolean> {
  if (!(await askTurnOff(categoryId))) return false;
  const undo = await stopRecurring(categoryId);
  if (quiet) return true;
  toast('Повторяющиеся платежи выключены', undo ? {
    label: UNDO,
    onPress: () => { undoStopRecurring(undo).then(() => toast('Повторяющиеся платежи снова включены')).catch(toastFailure('undo recurring', 'Не удалось восстановить')); },
  } : undefined);
  return true;
}
