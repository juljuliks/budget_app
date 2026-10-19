import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { RecurringPayment, todayKey } from '@/db/recurring';
import Button from '@/shared/ui/Button';
import SectionBand from '@/shared/ui/SectionBand';
import { formStyles } from '@/shared/theme/formStyles';
import type { PaymentWords } from '@/entities/category';
import type { PaymentTarget } from '../model/usePaymentForm';
import type { RecurringPaymentsData } from '../model/useRecurringPayments';
import { inMonth, inTime, periodText, shortDay } from '../texts';
import PaymentRow from './PaymentRow';

type Props = {
  ym: string;
  data: RecurringPaymentsData;
  w: PaymentWords;
  money: (minor: number, cur?: string) => string;
  shareOf: (minor: number) => string | null;
  /** the month's charges' sum (what saving up pays is not in it) */
  chargesMinor: number;
  /** what is saved up this month and how many are later: the line to "Предстоящие подписки" (none — no line) */
  upcoming: { savingMinor: number; count: number } | null;
  open: (target: PaymentTarget) => void;
  /** a merchant without a payment: its target */
  merchantTarget: (m: RecurringPaymentsData['merchants'][number]) => PaymentTarget;
  targetOf: (s: RecurringPayment) => PaymentTarget;
  onUpcoming: () => void;
  onAdd: () => void;
};

/**
 * The month's payments: "Списания в <месяце>" (done ✓ or the day), "Без даты списания" (a tap — set the day), the line to
 * the coming ones ("Предстоящие подписки ›"), "＋ Добавить подписку".
 */
export default function MonthPaymentsView({ ym, data, w, money, shareOf, chargesMinor, upcoming, open, merchantTarget, targetOf, onUpcoming, onAdd }: Props) {
  const today = todayKey();
  // "через N дней" — from today: in the current month only (a coming month's sheet says the day)
  const soon = (day: string) => (ym === today.slice(0, 7) ? inTime(day, today) : null);
  return (
    <>
      <SectionBand title={`Списания ${inMonth(ym)}`} total={money(chargesMinor)} share={shareOf(chargesMinor)} />
      {data.charges.length ? data.charges.map((c) => (
        <PaymentRow label={w.One}
          key={`${c.sub.id}-${c.day}`} name={c.sub.name} onPress={() => open(targetOf(c.sub))}
          note={[periodText(c.sub.period), ...(c.saved ? ['из отложенного'] : []), c.done ? `✓ списано ${shortDay(c.day)}` : [shortDay(c.day), soon(c.day)].filter(Boolean).join(', ')]}
          tone={c.done ? 'ok' : undefined} amount={money(c.sub.amount_minor, c.sub.currency)} muted={c.saved}
        />
      )) : <Text style={formStyles.hint}>{`Нет списаний ${inMonth(ym)}`}</Text>}

      {data.undated.length || data.merchants.length ? <SectionBand title="Без даты списания" /> : null}
      {data.undated.map((sub) => (
        <PaymentRow label={w.One}
          key={sub.id} name={sub.name} onPress={() => open(targetOf(sub))}
          note={[periodText(sub.period), 'Задать дату']} tone="warn" amount={money(sub.amount_minor, sub.currency)}
        />
      ))}
      {data.merchants.map((m) => (
        <PaymentRow label={w.One}
          key={m.merchant_key} name={m.name} note={[`последняя ${shortDay(m.day)}`, 'Задать дату']} tone="warn"
          amount={money(m.amount_minor, m.currency)} onPress={() => open(merchantTarget(m))}
        />
      ))}

      {upcoming ? (
        <PaymentRow label="Перейти" name={`${w.upcoming} ›`} onPress={onUpcoming}
          note={[upcoming.savingMinor ? `копим ${money(upcoming.savingMinor)} в месяц` : `${upcoming.count} позже`]}
          amount={null}
        />
      ) : null}
      {/* turned on and off in the plan (its kind "Повторяющийся платёж"); one stops — deleted in its sheet */}
      <Button title={`＋ ${w.add}`} outline onPress={onAdd} style={styles.add} />
    </>
  );
}

const styles = StyleSheet.create({
  add: { marginTop: 16 },
});
