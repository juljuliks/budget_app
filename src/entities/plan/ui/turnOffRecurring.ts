import { savedInCategory } from '@/db/recurring';
import { formatWithCurrency } from '@/shared/lib/money';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { stopRecurring } from '../model/commands';

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

/** Another kind picked in the plan for a category with repeating payments: asked if they saved something, then off; false — not. */
export async function turnOffRecurring(categoryId: number): Promise<boolean> {
  if (!(await askTurnOff(categoryId))) return false;
  await stopRecurring(categoryId);
  return true;
}
