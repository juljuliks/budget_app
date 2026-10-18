// The repeating payment sheet's form: name, amount, currency, period, the next charge's day, and what saving does to the plan.
import { useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { planEffect } from '@/db/plans';
import { offeredDue, todayKey } from '@/db/recurring';
import { parseAmountInput, toInputValue } from '@/shared/lib/money';

/** The category a payment is of (its name gives the words: "Подписка" in "Подписки", else "Платёж"). */
export type PaymentCategory = { id: number; name: string; emoji: string | null };

/** What the sheet opens with: a payment (`id`), or a new one — of a merchant, from its last charge. */
export type PaymentTarget = {
  id?: number;
  category: PaymentCategory;
  merchant_key: string | null;
  name: string;
  amount_minor: number;
  currency: Currency;
  period_months: number;
  /** the next charge's day; null — none yet */
  due: string | null;
  /** the merchant's last charge: the day offered is it plus the period (and follows the period) */
  last_day?: string;
  /** opened from that operation ("Пропустить" instead of "Отмена") */
  from_operation?: boolean;
};

export function usePaymentForm(target: PaymentTarget | null) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('GEL');
  const [period, setPeriodState] = useState(1);
  const [due, setDueState] = useState<string | null>(null);
  // the day picked by hand stays when the period changes
  const [dueByHand, setDueByHand] = useState(false);
  const [effect, setEffect] = useState<Awaited<ReturnType<typeof planEffect>>>(null);

  useEffect(() => {
    if (!target) return;
    setName(target.name);
    setAmount(toInputValue(target.amount_minor));
    setCurrency(target.currency);
    setPeriodState(target.period_months);
    setDueState(target.due ?? (target.last_day ? offeredDue(target.last_day, target.period_months, todayKey()) : null));
    setDueByHand(!!target.due && target.id !== undefined);
  }, [target]);

  const setPeriod = (months: number) => {
    setPeriodState(months);
    if (!dueByHand && target?.last_day) setDueState(offeredDue(target.last_day, months, todayKey()));
  };
  const setDue = (day: string) => { setDueState(day); setDueByHand(true); };

  const minor = parseAmountInput(amount);
  const input = target && minor !== null && name.trim()
    ? { category_id: target.category.id, merchant_key: target.merchant_key, name: name.trim(), amount_minor: minor, currency, period_months: period, due }
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

  return { name, setName, amount, setAmount, currency, setCurrency, period, setPeriod, due, setDue, input, effect };
}
