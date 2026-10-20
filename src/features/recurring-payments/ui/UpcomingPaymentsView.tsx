import React from 'react';
import { Text } from 'react-native';
import { chargeAt, ONCE, RecurringPayment } from '@/db/recurring';
import SectionBand from '@/shared/ui/SectionBand';
import { formStyles } from '@/shared/theme/formStyles';
import type { PaymentWords } from '@/entities/category';
import type { PaymentTarget } from '../model/usePaymentForm';
import type { RecurringPaymentsData } from '../model/useRecurringPayments';
import { inMonthYear, monthGen, periodText, shortDay } from '../texts';
import PaymentRow from './PaymentRow';

type Props = {
  ym: string;
  data: RecurringPaymentsData;
  w: PaymentWords;
  money: (minor: number, cur?: string) => string;
  shareOf: (minor: number) => string | null;
  savingMinor: number;
  chargesMinor: number;
  open: (target: PaymentTarget) => void;
  targetOf: (s: RecurringPayment) => PaymentTarget;
  onMonth: () => void;
};

/**
 * The payments saved up for, with the charge they save for: a later one, this month's not paid yet, or — this month's paid
 * from what was saved — the one after it; the payments not saved up for, by their next charge (one rarer than monthly
 * charged this month — the one after it).
 */
export function upcomingOf(data: RecurringPaymentsData) {
  const saving = data.saving.flatMap((v) => {
    const later = data.later.find((l) => l.sub.id === v.payment_id);
    const charges = data.charges.filter((c) => c.sub.id === v.payment_id);
    const sub = later?.sub ?? charges[0]?.sub;
    if (!sub) return [];
    const unpaid = charges.find((c) => !c.done);
    const last = charges[charges.length - 1];
    const day = later?.next ?? unpaid?.day ?? (sub.period === ONCE ? last.day : chargeAt(last.day, sub.period, 1));
    return [{ v, sub, day }];
  });
  const saved = (id: number) => data.saving.some((v) => v.payment_id === id);
  // one rarer than monthly already charged this month (a year's APPLE.COM): its next charge is a later month's too
  const paid = [...new Set(data.charges.map((c) => c.sub))].flatMap((sub) => {
    const own = data.charges.filter((c) => c.sub.id === sub.id);
    if (sub.period <= 1 || saved(sub.id) || own.some((c) => !c.done)) return [];
    const next = chargeAt(own[own.length - 1].day, sub.period, 1);
    return sub.until && next > sub.until ? [] : [{ sub, next }];
  });
  const plain = [...data.later.filter((l) => !saved(l.sub.id)), ...paid].sort((a, b) => a.next.localeCompare(b.next));
  return { saving, plain };
}

/**
 * "Предстоящие подписки": those saved up for ("Копим": a ring of what is saved, the month's contribution), those not
 * ("Без откладывания": the next charge and its month), the line back to the month's ones.
 */
export default function UpcomingPaymentsView({ ym, data, w, money, shareOf, savingMinor, chargesMinor, open, targetOf, onMonth }: Props) {
  const { saving, plain } = upcomingOf(data);
  return (
    <>
      <Text style={formStyles.hint}>Каждый месяц откладываем часть — к дате списания набирается вся сумма, и она не ударит по бюджету того месяца.</Text>
      {saving.length ? <SectionBand title="Копим" total={money(savingMinor)} share={shareOf(savingMinor)} /> : null}
      {saving.map(({ v, sub, day }) => (
        <PaymentRow label={w.One}
          key={sub.id} name={sub.name} onPress={() => open(targetOf(sub))} ring={sub.amount_minor ? v.end_minor / sub.amount_minor : 0}
          note={[periodText(sub.period), shortDay(day), `${money(v.end_minor, sub.currency)} из ${money(sub.amount_minor, sub.currency)}`]}
          amount={money(v.contribution_minor, sub.currency)} amountNote="в месяц"
        />
      ))}
      {plain.length ? <SectionBand title="Без откладывания" /> : null}
      {plain.map(({ sub, next }) => (
        <PaymentRow label={w.One}
          key={sub.id} name={sub.name} onPress={() => open(targetOf(sub))}
          note={[periodText(sub.period), shortDay(next)]}
          amount={money(sub.amount_minor, sub.currency)} amountNote={inMonthYear(next.slice(0, 7))} muted
        />
      ))}
      {!saving.length && !plain.length ? <Text style={formStyles.hint}>Пока ничего — всё списывается в этом месяце.</Text> : null}
      <PaymentRow label="Перейти" name={`${w.Many} ${monthGen(ym)} ›`} onPress={onMonth} note={[`списания ${money(chargesMinor)}`]} amount={null} />
    </>
  );
}
