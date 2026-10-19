// The repeating payment sheet's "Откладывать каждый месяц?": asked when it is charged less often than monthly (a one-off
// one: in a coming month); a new one
// saves by default. Already saving — what it has; turning it on — "Уже отложено". The month's contribution as a fund's.
import { useEffect, useState } from 'react';
import { contributionOf, currentYm, monthsBetween } from '@/db/plans';
import { ONCE, openSaving, Period, savedNow } from '@/db/recurring';
import { parseAmountOrZero } from '@/shared/lib/money';
import type { PaymentTarget } from './usePaymentForm';

/** What the sheet sends on "Сохранить": save up or not, from what; whether it was saving and what it has. */
export type SavingChoice = { on: boolean; start: number; had: boolean; balance: number };

export function usePaymentSaving(target: PaymentTarget | null, period: Period, amount: number | null, due: string | null) {
  const [save, setSave] = useState(false);
  const [start, setStart] = useState('');
  const [had, setHad] = useState<{ saving: boolean; balance: number } | null>(null);

  useEffect(() => {
    if (!target) return undefined;
    setStart('');
    if (target.id === undefined) { setHad({ saving: false, balance: 0 }); setSave(true); return undefined; }
    let live = true;
    Promise.all([openSaving(target.id), savedNow(target.id)])
      .then(([open, balance]) => { if (live) { setHad({ saving: !!open, balance }); setSave(!!open); } })
      .catch((e) => console.error('payment saving failed', e));
    return () => { live = false; };
  }, [target]);

  const nowYm = currentYm();
  const offered = period > 1 || (period === ONCE && !!due && due.slice(0, 7) > nowYm);
  const on = offered && save;
  const startMinor = had?.saving ? had.balance : parseAmountOrZero(start) ?? 0;
  const contribution = on && due && amount !== null ? contributionOf({ target_minor: amount, due }, nowYm, startMinor) : null;
  const months = due ? monthsBetween(nowYm, due.slice(0, 7)) : 0;
  const choice: SavingChoice | null = had ? { on, start: startMinor, had: had.saving, balance: had.balance } : null;
  return { offered, save, setSave, start, setStart, had, contribution, months, choice, startBad: !had?.saving && on && parseAmountOrZero(start) === null };
}
