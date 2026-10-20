// The repeating payment sheet's form: name, amount, currency, period, the next charge's day, and what saving does to the plan.
import { useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { planEffect } from '@/db/plans';
import { chargeBefore, offeredDue, paymentNext, Period, todayKey } from '@/db/recurring';
import { parseAmountInput, toInputValue } from '@/shared/lib/money';

/** The category a payment is of (its name gives the words: "Подписка" in "Подписки", else "Платёж"). */
export type PaymentCategory = { id: number; name: string; emoji: string | null };

/** What the sheet opens with: a payment (`id`), or a new one — of an operation's merchant, from that operation. */
export type PaymentTarget = {
  id?: number;
  category: PaymentCategory;
  /** null — the category's own payment (its spending is its charges) */
  merchant_key: string | null;
  name: string;
  amount_minor: number;
  currency: Currency;
  period: Period;
  /** the next charge's day; null — none yet */
  due: string | null;
  /** "Дата окончания": no charges after it */
  until?: string | null;
  /** the merchant's last charge: the day offered is it plus the period (and follows the period) */
  last_day?: string;
  /** opened from that operation ("Пропустить" instead of "Отмена") */
  from_operation?: boolean;
};

export function usePaymentForm(target: PaymentTarget | null) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('GEL');
  const [period, setPeriodState] = useState<Period>(1);
  const [due, setDueState] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  // the day picked by hand in this sheet stays when the period changes
  const [dueByHand, setDueByHand] = useState(false);
  // the charge another period is counted from: the merchant's last, or a saved payment's next one less its period
  const [lastCharge, setLastCharge] = useState<string | null>(null);
  const [effect, setEffect] = useState<Awaited<ReturnType<typeof planEffect>>>(null);

  useEffect(() => {
    if (!target) return undefined;
    setName(target.name);
    setAmount(toInputValue(target.amount_minor));
    setCurrency(target.currency);
    setPeriodState(target.period);
    setUntil(target.until ?? null);
    setDueState(target.due ?? (target.last_day ? offeredDue(target.last_day, target.period, todayKey()) : null));
    setDueByHand(false);
    setLastCharge(target.last_day ?? null);
    if (target.id === undefined || !target.due || target.last_day) return undefined;
    // its stored day may be long past: the next charge from its operations (a one-off one past — its day)
    let live = true;
    paymentNext(target.id).then((next) => {
      if (!live) return;
      if (next) setDueState(next);
      setLastCharge(next ? chargeBefore(next, target.period) : target.due);
    }).catch((e) => console.error('payment next failed', e));
    return () => { live = false; };
  }, [target]);

  const setPeriod = (p: Period) => {
    setPeriodState(p);
    if (!dueByHand && lastCharge) setDueState(offeredDue(lastCharge, p, todayKey()));
  };
  const setDue = (day: string) => { setDueState(day); setDueByHand(true); };

  const minor = parseAmountInput(amount);
  const input = target && minor !== null && name.trim()
    ? { category_id: target.category.id, merchant_key: target.merchant_key, name: name.trim(), amount_minor: minor, currency, period, due, until: period === 0 ? null : until }
    : null;

  // "В план октября +30 ₾": counted again as the form changes
  const key = input ? JSON.stringify(input) : '';
  useEffect(() => {
    if (!input || !input.due) { setEffect(null); return undefined; }
    let live = true;
    planEffect(input, target?.id).then((e) => { if (live) setEffect(e); }).catch((e) => console.error('plan effect failed', e));
    return () => { live = false; };
    // the input as a whole, by its key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, target?.id]);

  return { name, setName, amount, setAmount, currency, setCurrency, period, setPeriod, due, setDue, until, setUntil, input, effect };
}
