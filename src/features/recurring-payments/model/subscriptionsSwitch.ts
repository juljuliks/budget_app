// "Подписки" on a category's page turned on or off: what goes is asked first — on: its own regular payment; off: its
// subscriptions (what they saved goes to this month's savings, the amount in the plan stays by hand).
import { currentYm } from '@/db/plans';
import { paymentsOfCategory, savedInCategory, setSubscriptions } from '@/db/recurring';
import { emitTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { plural } from '@/shared/lib/format';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastFailure } from '@/shared/ui/toast';
import { monthGen } from '../texts';

function turn(categoryId: number, on: boolean, onDone: () => void) {
  setSubscriptions(categoryId, on)
    .then(() => { emitTransactionsChanged(); onDone(); toast(on ? 'Подписки включены' : 'Подписки выключены'); })
    .catch(toastFailure('turn subscriptions', SAVE_FAILED));
}

/** Turns them on or off; something to delete — asked first. */
export async function switchSubscriptions(categoryId: number, on: boolean, onDone: () => void): Promise<void> {
  const gone = (await paymentsOfCategory(categoryId)).filter((p) => !!p.merchant_key !== on);
  if (!gone.length) { turn(categoryId, on, onDone); return; }
  const saved = (await savedInCategory(categoryId)).map((s) => formatWithCurrency(s.minor, s.currency));
  const kept = saved.length ? ` Отложенное (${saved.join(', ')}) уйдёт в сбережения ${monthGen(currentYm())}.` : '';
  const n = gone.length;
  sheetAlert(
    on ? 'Включить подписки?' : 'Выключить подписки?',
    on
      ? `Регулярный платёж «${gone[0].name}» удалится; сумма в плане останется, пока у подписок нет даты.${kept}`
      : `${n} ${plural(n, ['подписка удалится', 'подписки удалятся', 'подписок удалятся'])}; сумма в плане останется, операции — тоже.${kept}`,
    [{ text: 'Отмена', style: 'cancel' }, { text: on ? 'Включить' : 'Выключить', style: on ? 'default' : 'destructive', onPress: () => turn(categoryId, on, onDone) }]);
}
