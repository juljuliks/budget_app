// A subscription saved (its charges past what is free in the plan: "Вычесть из сбережений?"), skipped, deleted; saved up
// for or not (turned off with something saved, or deleted: asked first — what it had goes to this month's savings).
import { currentYm, planEffect, subscriptionShort, takeLocked } from '@/db/plans';
import {
  deleteSubscription, restoreSubscription, savedNow, saveSubscription, SavingUndo, startSaving, stopSaving, SubscriptionInput, undoSaving,
} from '@/db/subscriptions';
import { emitTransactionsChanged } from '@/domain/events';
import { askTakeLocked } from '@/entities/plan';
import { SAVE_FAILED, UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';
import { formatWithCurrency } from '@/shared/lib/money';
import { longDay, monthGen } from '../texts';
import type { SavingChoice } from './useSubscriptionSaving';
import type { PaymentCategory } from './useSubscriptionForm';
import { paymentWords } from '@/entities/category';

/** "Отменить" of a saving turned off: it back, with what it had. */
const undoAction = (undo: SavingUndo, name: string) => ({
  label: UNDO,
  onPress: () => {
    undoSaving(undo).then(() => { emitTransactionsChanged(); toast(`${name} — снова откладываем`); })
      .catch(toastFailure('undo saving', 'Не удалось восстановить'));
  },
});

async function write(input: SubscriptionInput, id: number | undefined, onDone: () => void, saving?: SavingChoice | null) {
  try {
    const subId = await saveSubscription(input, id);
    const on = !!saving?.on && !!input.due;
    if (on && !saving!.had) await startSaving(subId, saving!.start);
    const stopped = !on && saving?.had ? await stopSaving(subId) : null;
    emitTransactionsChanged();
    onDone();
    if (stopped && stopped.released > 0) {
      const released = formatWithCurrency(stopped.released, input.currency);
      toast(`${input.name} — без откладывания, ${released} в сбережениях ${monthGen(currentYm())}`, undoAction(stopped.undo, input.name));
      return;
    }
    toast(input.due ? `${input.name} — следующее списание ${longDay(input.due)}` : `${input.name} — без даты списания`);
  } catch (e) {
    console.error('save subscription failed', e);
    toastError(SAVE_FAILED);
  }
}

/**
 * Saves a subscription. This month's charges past what is free in the plan: "Вычесть из сбережений?" while 🔒 has
 * enough (no — not saved); more than it has — saved, the plan over its budget. Saving turned off with something in it:
 * "Не откладывать на …?" first.
 */
export function saveSub(input: SubscriptionInput, id: number | undefined, onDone: () => void, saving?: SavingChoice | null) {
  if (saving?.had && !(saving.on && input.due) && saving.balance > 0) {
    const due = input.due ? ` Списание ${longDay(input.due)} (${formatWithCurrency(input.amount_minor, input.currency)}) встанет в план ${monthGen(input.due.slice(0, 7))} целиком.` : '';
    sheetAlert(
      `Не откладывать на ${input.name}?`,
      `На «${input.name}» уже отложено ${formatWithCurrency(saving.balance, input.currency)}. Они уйдут в сбережения ${monthGen(currentYm())} — как при удалении копилки.${due}`,
      [{ text: 'Отмена', style: 'cancel' }, { text: 'Не откладывать', style: 'destructive', onPress: () => { check(input, id, onDone, saving); } }]);
    return;
  }
  check(input, id, onDone, saving);
}

async function check(input: SubscriptionInput, id: number | undefined, onDone: () => void, saving?: SavingChoice | null) {
  try {
    const effect = await planEffect(input, id);
    const over = effect && effect.ym === currentYm() ? await subscriptionShort(effect.ym, effect.delta_minor) : null;
    if (over && over.short <= over.locked) {
      askTakeLocked({ ...over, adding: id === undefined, onYes: () => {
        takeLocked(effect!.ym, over.short).then(() => write(input, id, onDone, saving)).catch(toastFailure('take locked', SAVE_FAILED));
      } });
      return;
    }
  } catch (e) {
    console.error('subscription plan check failed', e);
  }
  await write(input, id, onDone, saving);
}

async function remove(id: number, name: string, category: PaymentCategory, onDone: () => void) {
  const w = paymentWords(category.name);
  try {
    const stopped = await deleteSubscription(id);
    emitTransactionsChanged();
    onDone();
    toast(`${w.One} «${name}» ${w.deleted}`, {
      label: UNDO,
      onPress: () => {
        restoreSubscription(id, stopped?.undo).then(() => { emitTransactionsChanged(); toast(`${w.One} «${name}» снова в плане`); })
          .catch(toastFailure('restore subscription', 'Не удалось восстановить'));
      },
    });
  } catch (e) {
    console.error('delete subscription failed', e);
    toastError(SAVE_FAILED);
  }
}

/**
 * "Удалить подписку «Netflix»?": its charges leave the plan from this month, the operations stay; something saved up for
 * it goes to this month's savings.
 */
export async function confirmDeleteSub(id: number, name: string, currency: string, category: PaymentCategory, onDone: () => void) {
  const w = paymentWords(category.name);
  const saved = await savedNow(id).catch(() => 0);
  const kept = saved > 0 ? ` На ${w.acc} уже отложено ${formatWithCurrency(saved, currency)} — они уйдут в сбережения ${monthGen(currentYm())}.` : '';
  sheetAlert(
    `Удалить ${w.acc} «${name}»?`,
    `Списания уйдут из плана с этого месяца. Операции останутся в категории «${category.name}».${kept}`,
    [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => { remove(id, name, category, onDone); } }]);
}
