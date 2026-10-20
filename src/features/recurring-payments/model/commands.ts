// A repeating payment saved (its charges past what is free in the plan: "Вычесть из сбережений?"), skipped, deleted; saved up
// for or not (turned off with something saved, or deleted: asked first — what it had goes to this month's savings).
import { currentYm, paymentShort, planEffect, recurringShort, takeLocked } from '@/db/plans';
import {
  ONCE, categoryPayment,
  deletePayment, restorePayment, savedNow, savePayment, SavingUndo, startSaving, stopSaving, PaymentInput, undoSaving,
} from '@/db/recurring';
import { emitTransactionsChanged } from '@/domain/events';
import { askTakeLocked } from '@/entities/plan';
import { SAVE_FAILED, UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';
import { formatWithCurrency } from '@/shared/lib/money';
import { longDay, monthGen } from '../texts';
import type { SavingChoice } from '@/entities/plan';
import type { PaymentCategory } from './usePaymentForm';
import { SUBSCRIPTION_WORDS as w } from '@/entities/category';

/** "Отменить" of a saving turned off: it back, with what it had. */
const undoAction = (undo: SavingUndo, name: string) => ({
  label: UNDO,
  onPress: () => {
    undoSaving(undo).then(() => { emitTransactionsChanged(); toast(`${name} — снова откладываем`); })
      .catch(toastFailure('undo saving', 'Не удалось восстановить'));
  },
});

async function write(input: PaymentInput, id: number | undefined, onDone: () => void, saving?: SavingChoice | null) {
  try {
    const subId = await savePayment(input, id);
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
    toast(!input.due ? `${input.name} — без даты списания` : input.period === ONCE ? `${input.name} — списание ${longDay(input.due)}` : `${input.name} — следующее списание ${longDay(input.due)}`);
  } catch (e) {
    console.error('save payment failed', e);
    toastError(SAVE_FAILED);
  }
}

/**
 * Saves a repeating payment. This month's charges (and a new contribution) past what is free in the plan: "Вычесть из
 * сбережений?" while 🔒 has something (no — not saved; more than it has — all of it, the plan over its budget). Saving turned off with something in it:
 * "Не откладывать на …?" first.
 */
export function submitPayment(input: PaymentInput, id: number | undefined, onDone: () => void, saving?: SavingChoice | null) {
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

// this month's plan only: charged first in a later month (0 now) — nothing asked
async function check(input: PaymentInput, id: number | undefined, onDone: () => void, saving?: SavingChoice | null) {
  try {
    const ym = currentYm();
    const effect = await planEffect(input, id);
    const now = effect && effect.ym === ym;
    const charges = now ? effect.delta_minor : 0;
    const contribution = saving?.on && input.due ? { minor: saving.contribution, currency: input.currency } : undefined;
    // the category's item by hand till now (its first payment with a day): it becomes the month's charges
    // a subscription replaces the category's own payment: not on top of it
    const replacing = !!input.merchant_key && !!input.category_id && !!(await categoryPayment(input.category_id));
    const over = input.category_id
      ? await paymentShort(ym, input.category_id, charges, { minor: now ? effect.after_minor : 0, currency: effect?.currency ?? input.currency }, contribution, replacing)
      : await recurringShort(ym, charges, contribution);
    if (over && over.locked > 0) {
      askTakeLocked({ ...over, adding: id === undefined, onYes: (take) => {
        takeLocked(ym, take).then(() => write(input, id, onDone, saving)).catch(toastFailure('take locked', SAVE_FAILED));
      } });
      return;
    }
  } catch (e) {
    console.error('payment plan check failed', e);
  }
  await write(input, id, onDone, saving);
}

async function remove(id: number, name: string, category: PaymentCategory, onDone: () => void) {
  try {
    const deleted = await deletePayment(id);
    emitTransactionsChanged();
    onDone();
    // the category's last one: its repeating payments went off
    toast(`${w.One} «${name}» ${w.deleted}${deleted.off ? ', регулярные платежи выключены' : ''}`, {
      label: UNDO,
      onPress: () => {
        restorePayment(id, deleted).then(() => { emitTransactionsChanged(); toast(`${w.One} «${name}» снова в плане`); })
          .catch(toastFailure('restore payment', 'Не удалось восстановить'));
      },
    });
  } catch (e) {
    console.error('delete payment failed', e);
    toastError(SAVE_FAILED);
  }
}

/**
 * "Удалить подписку «Netflix»?": its charges leave the plan from this month, the operations stay; something saved up for
 * it goes to this month's savings.
 */
export async function confirmDeletePayment(id: number, name: string, currency: string, category: PaymentCategory, onDone: () => void) {
  const saved = await savedNow(id).catch(() => 0);
  const kept = saved > 0 ? ` На ${w.acc} уже отложено ${formatWithCurrency(saved, currency)} — они уйдут в сбережения ${monthGen(currentYm())}.` : '';
  sheetAlert(
    `Удалить ${w.acc} «${name}»?`,
    `Списания уйдут из плана с этого месяца. Операции останутся в категории «${category.name}».${kept}`,
    [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => { remove(id, name, category, onDone); } }]);
}
