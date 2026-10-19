// "Повторяющийся платёж" saved from the plan's sheet: this month's charges past what is free — "Вычесть из сбережений?".
import { Currency } from '@/db/fx';
import { currentYm, itemShort, planEffect, takeLocked } from '@/db/plans';
import { categoryPayment } from '@/db/recurring';
import { formatWithCurrency } from '@/shared/lib/money';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { toastFailure } from '@/shared/ui/toast';
import { saveRecurring } from '../model/commands';
import { askTakeLocked } from './askTakeLocked';
import { dateNeeded, RecurringForm } from './RecurringFields';

type Saved = (taken?: string) => void;

/**
 * The sheet's "Сохранить" of a repeating payment: an error to show, null — saved, false — asked over the sheet (it stays
 * open; "Вычесть …" saves and closes it). Only this month's plan is checked: charged first later (0 now) — not asked.
 */
export async function submitRecurring(
  ym: string, categoryId: number, minor: number, currency: Currency, v: RecurringForm, adding: boolean, saved: Saved, onClose: () => void,
): Promise<string | null | false> {
  if (!minor) return 'Введите сумму платежа';
  if (v.period !== 1 && !v.next) return dateNeeded(v.period);
  const p = { amount_minor: minor, currency, period: v.period, due: v.next };
  const over = ym === currentYm() ? await shortOf(ym, categoryId, p).catch((e) => { console.error('recurring plan check failed', e); return null; }) : null;
  if (over && over.locked > 0) {
    askTakeLocked({
      ...over, adding,
      onYes: (take) => takeLocked(ym, take).then(() => saveRecurring(ym, categoryId, p))
        .then(() => { saved(formatWithCurrency(take, over.currency)); onClose(); })
        .catch(toastFailure('save recurring from savings', SAVE_FAILED)),
    });
    return false;
  }
  await saveRecurring(ym, categoryId, p);
  saved();
  return null;
}

/** The category's item as its payment's charges in `ym` (no day — the amount by hand): what is short of free. */
async function shortOf(ym: string, categoryId: number, p: { amount_minor: number; currency: Currency; period: number; due: string | null }) {
  if (!p.due) return itemShort(ym, categoryId, p.amount_minor, p.currency);
  const own = await categoryPayment(categoryId);
  const effect = await planEffect({ ...p, category_id: categoryId, merchant_key: null } as Parameters<typeof planEffect>[0], own?.id);
  return itemShort(ym, categoryId, effect && effect.ym === ym ? effect.after_minor : 0, effect?.currency ?? p.currency);
}
