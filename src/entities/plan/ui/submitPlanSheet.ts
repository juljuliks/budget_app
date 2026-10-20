// The plan sheet's "Сохранить": a limit (repeated each month till its end), a one-off payment, a fund, a regular payment
// within the month, or the amount by hand of a category with regular payments; past what is free — 🔒 asked.
import { Currency } from '@/db/fx';
import { NormPeriod, OverBudgetError, PlanKind, setPlanPinned } from '@/db/plans';
import { AMOUNT_HINT, SAVE_FAILED } from '@/shared/lib/strings';
import { formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import { toast, toastFailure } from '@/shared/ui/toast';
import { saveFund, savePlanAmount, saveRegular } from '../model/commands';
import { turnOffRecurring } from './turnOffRecurring';
import { askTakeLocked } from './askTakeLocked';
import { savedText } from './sheetOptions';
import type { RegularEvery } from './RegularFields';
import type { SavingChoice } from '../model/usePaymentSaving';
import { submitCategoryPayment } from './submitCategoryPayment';
import { dateNeeded, UNTIL_BEFORE } from './sheetOptions';
import type { PlanAmountTarget } from './PlanAmountModal';

export type PlanSheetValues = {
  kind: PlanKind; currency: Currency; norm: NormPeriod; due: string | null; start: string;
  pinned: boolean; until: string | null; every: RegularEvery; weekdays: number; period: number; next: string | null;
  /** "Откладывать каждый месяц?" of a regular payment rarer than monthly; `startBad` — "Уже отложено" not an amount */
  saving?: (SavingChoice & { startBad: boolean }) | null;
};

type Args = {
  ym: string; target: PlanAmountTarget; text: string; v: PlanSheetValues; adding: boolean;
  /** what 🔒 has, in the budget's currency; what is free (for the error) */
  locked: number; free: { minor: number; currency: Currency } | null;
  onSaved: () => void; onClose: () => void;
};

/** An error to show, null — saved, false — asked over the sheet (it stays open). */
export async function submitPlanSheet({ ym, target, text, v, adding, locked, free, onSaved, onClose }: Args): Promise<string | null | false> {
  const minor = parseAmountOrZero(text);
  if (minor === null) return AMOUNT_HINT;
  const k = v.kind;
  // a category with "Подписки": its amount by hand (until one of them has a day); else its own payment
  const byHand = k === 'subs' && !!target.by_merchant;
  const regular = k === 'subs' && !byHand && v.every !== 'month';
  const own = k === 'subs' && !byHand && v.every === 'month';
  const startMinor = parseAmountOrZero(v.start ?? '');
  if (k === 'fund' && (!minor || startMinor === null)) return minor ? AMOUNT_HINT : 'Введите, сколько накопить';
  if (regular && !minor) return 'Введите сумму за раз';
  if (regular && v.every === 'week' && !v.weekdays) return 'Выберите дни недели';
  if (own && !minor) return 'Введите сумму платежа';
  // monthly: no day — the amount in each month's plan (a day it had is dropped)
  const due = own && v.period !== 1 ? v.next : null;
  if (own && !due && v.period !== 1) return dateNeeded();
  if (own && v.until && due && v.until < due) return UNTIL_BEFORE;
  if (own && v.saving?.startBad) return AMOUNT_HINT;
  // another kind (or a regular payment within the month) for a category with regular payments: they are turned off
  // first (asked if they saved something)
  const off = !!target.recurring && (k !== 'subs' || regular);
  if (off && !(await turnOffRecurring(target.category_id))) return false;
  const saved = (taken?: string) => { toast(savedText(k, target.label, adding, off, taken)); onSaved(); };
  if (own) return submitCategoryPayment(ym, target, { amount_minor: minor, currency: v.currency, period: v.period, due, until: v.until, saving: v.period > 1 ? v.saving : null }, adding, saved, onClose, free);
  const write = async (takeLocked: boolean) => {
    if (k === 'fund' && v.due) return saveFund(ym, target.category_id, { target_minor: minor, currency: v.currency, due: v.due, start_minor: startMinor ?? 0 }, undefined, takeLocked);
    if (regular) {
      return saveRegular(ym, target.category_id, { every: v.every as 'day' | 'week', weekdays: v.weekdays, unit_minor: minor, until: v.until }, v.currency, takeLocked);
    }
    await savePlanAmount(ym, target.category_id, minor, byHand ? 'fixed' : k, v.currency, v.norm, takeLocked);
    // "Повторять каждый месяц" and its end: a limit's only (a one-off payment isn't carried over)
    const pin = k === 'limit' && v.pinned;
    const until = pin ? v.until : null;
    if (!byHand && (pin !== !!target.pinned || until !== (target.until ?? null))) await setPlanPinned(ym, target.category_id, pin, until);
  };
  try {
    await write(false);
  } catch (e) {
    if (!(e instanceof OverBudgetError)) throw e;
    const short = e.planned_minor - e.budget_minor;
    // what isn't free is in "🔒 Отложить сразу": asked over the sheet, which stays open
    if (short <= locked) {
      askTakeLocked({
        short, locked, currency: e.currency, adding,
        onYes: () => write(true)
          .then(() => { saved(formatWithCurrency(short, e.currency)); onClose(); })
          .catch(toastFailure('save plan amount from savings', SAVE_FAILED)),
      });
      return false;
    }
    const room = `можно запланировать до ${free ? formatWithCurrency(free.minor, free.currency) : '0'}`;
    return k === 'fund' ? `Взнос больше бюджета месяца: ${room}. Выберите дату позже` : `Больше бюджета месяца: ${room}`;
  }
  saved();
  return null;
}
