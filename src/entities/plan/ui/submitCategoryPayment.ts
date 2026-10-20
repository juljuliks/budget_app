// A regular payment, monthly or rarer: the category's own payment saved from the plan's sheet; rarer — saved up for or
// not ("Откладывать каждый месяц?": turned off with something saved — asked first); this month's charges and a new
// contribution past what is free — "Вычесть из сбережений?".
import { Currency } from '@/db/fx';
import { currentYm, OverBudgetError, paymentShort, planEffect, takeLocked } from '@/db/plans';
import { categoryPayment } from '@/db/recurring';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthGen } from '@/shared/lib/dates';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import type { SavingChoice } from '../model/usePaymentSaving';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { toastError, toastFailure } from '@/shared/ui/toast';
import { saveCategoryPayment } from '../model/commands';
import { askTakeLocked } from './askTakeLocked';
import type { PlanAmountTarget } from './PlanAmountModal';

/** `due` null — a monthly one without a day: the amount by hand in each month's plan */
type Payment = { amount_minor: number; currency: Currency; period: number; due: string | null; until: string | null; saving?: SavingChoice | null };
type Free = { minor: number; currency: Currency } | null;

/** An error to show, null — saved, false — asked over the sheet (it stays open; the answer saves and closes it). */
export async function submitCategoryPayment(
  ym: string, target: PlanAmountTarget, p: Payment, adding: boolean, saved: (taken?: string) => void, onClose: () => void, free: Free,
): Promise<string | null | false> {
  const s = p.saving;
  if (s?.had && !(s.on && p.due) && s.balance > 0) {
    sheetAlert(
      `Не откладывать на «${target.label}»?`,
      `Уже отложено ${formatWithCurrency(s.balance, p.currency)}. Они уйдут в сбережения ${monthGen(currentYm())} — как при удалении копилки.`,
      [{ text: 'Отмена', style: 'cancel' }, { text: 'Не откладывать', style: 'destructive', onPress: () => {
        checkAndSave(ym, target.category_id, p, adding, free, (taken) => { saved(taken); onClose(); })
          .then((err) => { if (err) toastError(err); }).catch(toastFailure('save category payment', SAVE_FAILED));
      } }]);
    return false;
  }
  return checkAndSave(ym, target.category_id, p, adding, free, (taken) => saved(taken), onClose);
}

/**
 * What is short of free: a dated one — this month's plan only (charged first later, 0 now — not asked); without a day —
 * its month's item becomes the amount.
 */
async function shortOf(ym: string, categoryId: number, p: Payment) {
  if (!p.due) return paymentShort(ym, categoryId, 0, { minor: p.amount_minor, currency: p.currency }, undefined, true);
  if (ym !== currentYm()) return null;
  const own = await categoryPayment(categoryId);
  const effect = await planEffect({ ...p, category_id: categoryId, merchant_key: null }, own?.id);
  const now = !!effect && effect.ym === ym;
  // saving up for it from now: its contribution in this month's plan too
  const s = p.saving;
  const contribution = s?.on && !s.had ? { minor: s.contribution, currency: p.currency } : undefined;
  return effect ? paymentShort(ym, categoryId, now ? effect.delta_minor : 0, { minor: now ? effect.after_minor : 0, currency: effect.currency }, contribution) : null;
}

async function checkAndSave(ym: string, categoryId: number, p: Payment, adding: boolean, free: Free, done: (taken?: string) => void, onClose?: () => void): Promise<string | null | false> {
  const over = await shortOf(ym, categoryId, p);
  if (over && over.locked > 0) {
    askTakeLocked({
      ...over, adding,
      onYes: (take) => takeLocked(ym, take).then(() => saveCategoryPayment(ym, categoryId, p))
        .then(() => { done(formatWithCurrency(take, over.currency)); onClose?.(); })
        .catch(toastFailure('save category payment from savings', SAVE_FAILED)),
    });
    return false;
  }
  try {
    await saveCategoryPayment(ym, categoryId, p);
  } catch (e) {
    if (!(e instanceof OverBudgetError)) throw e;
    return `Больше бюджета месяца: можно запланировать до ${free ? formatWithCurrency(free.minor, free.currency) : '0'}`;
  }
  done();
  return null;
}
