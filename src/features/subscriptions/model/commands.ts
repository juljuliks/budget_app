// A subscription saved (its charges past what is free in the plan: "Вычесть из сбережений?"), skipped, deleted.
import { currentYm, planEffect, subscriptionShort, takeLocked } from '@/db/plans';
import { deleteSubscription, restoreSubscription, saveSubscription, SubscriptionInput } from '@/db/subscriptions';
import { emitTransactionsChanged } from '@/domain/events';
import { askTakeLocked } from '@/entities/plan';
import { SAVE_FAILED, UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';
import { longDay } from '../texts';

async function write(input: SubscriptionInput, id: number | undefined, onDone: () => void) {
  try {
    await saveSubscription(input, id);
    emitTransactionsChanged();
    onDone();
    toast(input.due ? `${input.name} — следующее списание ${longDay(input.due)}` : `${input.name} — без даты списания`);
  } catch (e) {
    console.error('save subscription failed', e);
    toastError(SAVE_FAILED);
  }
}

/**
 * Saves a subscription. This month's charges past what is free in the plan: "Вычесть из сбережений?" while 🔒 has
 * enough (no — not saved); more than it has — saved, the plan over its budget.
 */
export async function saveSub(input: SubscriptionInput, id: number | undefined, onDone: () => void) {
  try {
    const effect = await planEffect(input, id);
    const over = effect && effect.ym === currentYm() ? await subscriptionShort(effect.ym, effect.delta_minor) : null;
    if (over && over.short <= over.locked) {
      askTakeLocked({ ...over, adding: id === undefined, onYes: () => {
        takeLocked(effect!.ym, over.short).then(() => write(input, id, onDone)).catch(toastFailure('take locked', SAVE_FAILED));
      } });
      return;
    }
  } catch (e) {
    console.error('subscription plan check failed', e);
  }
  await write(input, id, onDone);
}

async function remove(id: number, name: string, onDone: () => void) {
  try {
    await deleteSubscription(id);
    emitTransactionsChanged();
    onDone();
    toast(`Подписка «${name}» удалена`, {
      label: UNDO,
      onPress: () => {
        restoreSubscription(id).then(() => { emitTransactionsChanged(); toast(`Подписка «${name}» снова в плане`); })
          .catch(toastFailure('restore subscription', 'Не удалось восстановить'));
      },
    });
  } catch (e) {
    console.error('delete subscription failed', e);
    toastError(SAVE_FAILED);
  }
}

/** "Удалить подписку «Netflix»?": its charges leave the plan from this month, the operations stay. */
export function confirmDeleteSub(id: number, name: string, onDone: () => void) {
  sheetAlert(
    `Удалить подписку «${name}»?`,
    'Её списания уйдут из плана с этого месяца. Операции останутся в «Подписках».',
    [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => { remove(id, name, onDone); } }]);
}
