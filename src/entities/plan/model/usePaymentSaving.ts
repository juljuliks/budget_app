// The repeating payment sheet's "Откладывать каждый месяц?": asked when it is charged less often than monthly (not a
// one-off one: what is left after its charge would have nowhere to go); a new one
// saves by default. Already saving — what it has; turning it on — "Уже отложено". The month's contribution as a fund's.
import { useEffect, useState } from 'react';
import { contributionOf, currentYm, monthsBetween } from '@/db/plans';
import { openSaving, Period, savedNow } from '@/db/recurring';
import { parseAmountOrZero } from '@/shared/lib/money';

/**
 * What the sheet sends on "Сохранить": save up or not, from what; whether it was saving and what it has; turned on now —
 * this month's contribution (in the payment's currency; it is checked against the plan's budget).
 */
export type SavingChoice = { on: boolean; start: number; had: boolean; balance: number; contribution: number };

/** `target`: the payment (`id`; none — a new one), null — not yet known; another object — asked again from the start. */
export function usePaymentSaving(target: { id?: number } | null, period: Period, amount: number | null, due: string | null) {
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

  const offered = period > 1;
  const on = offered && save;
  const startMinor = had?.saving ? had.balance : parseAmountOrZero(start) ?? 0;
  const nowYm = currentYm();
  const contribution = on && due && amount !== null ? contributionOf({ target_minor: amount, due }, nowYm, startMinor) : null;
  const months = due ? monthsBetween(nowYm, due.slice(0, 7)) : 0;
  const choice: SavingChoice | null = had ? { on, start: startMinor, had: had.saving, balance: had.balance, contribution: had.saving ? 0 : contribution ?? 0 } : null;
  return { offered, save, setSave, start, setStart, had, contribution, months, choice, startBad: !had?.saving && on && parseAmountOrZero(start) === null };
}
