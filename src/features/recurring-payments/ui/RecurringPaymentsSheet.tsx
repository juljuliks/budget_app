import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Currency } from '@/db/fx';
import type { RecurringPayment } from '@/db/recurring';
import { formatWithCurrency } from '@/shared/lib/money';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { openCategory, pickPaymentOperation } from '@/shared/navigation/navigation';
import { monthDays } from '@/shared/lib/dateRange';
import Loading from '@/shared/ui/Loading';
import TextLink from '@/shared/ui/TextLink';
import { formatPercent } from '@/shared/lib/format';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { paymentWords } from '@/entities/category';
import { PaymentCategory, PaymentTarget } from '../model/usePaymentForm';
import { useRecurringPayments } from '../model/useRecurringPayments';
import { inMonth, monthGen } from '../texts';
import MonthPaymentsView from './MonthPaymentsView';
import PaymentSheet from './PaymentSheet';
import UpcomingPaymentsView, { upcomingOf } from './UpcomingPaymentsView';

/** The month's payments, or the coming ones (saved up for, and later) */
export type PaymentsView = 'month' | 'upcoming';

type Props = {
  /** the plan's month; null = closed */
  ym: string | null;
  /** the category with "Повторяющиеся платежи" */
  category: PaymentCategory;
  currency: Currency;
  /** what it opens with; each view has a line to the other */
  view?: PaymentsView;
  onClose: () => void;
  /** the category's plan sheet: the amount put in by hand (no payment has a day yet), another kind, out of the plan */
  onEditAmount: () => void;
};

const savingSum = (m: { saving: Array<{ converted_minor: number | null }> }) => m.saving.reduce((a, v) => a + (v.converted_minor ?? 0), 0);

/**
 * A category's repeating payments in the plan's month, two views: the month's ("Подписки": its charges, those without a
 * day, "＋ Добавить подписку") and the coming ones ("Предстоящие подписки": saved up for, and later). A tap opens a payment.
 */
export default function RecurringPaymentsSheet({ ym, category, currency, view: initial = 'month', onClose, onEditAmount }: Props) {
  const { data, failed, load } = useRecurringPayments(ym, currency, category.id);
  const w = paymentWords(category.name);
  const targetOf = (s: RecurringPayment): PaymentTarget => ({ ...s, category });
  const [view, setView] = useState<PaymentsView>(initial);
  const [open, setOpen] = useState<PaymentTarget | null>(null);
  const money = (minor: number, cur: string = currency) => formatWithCurrency(minor, cur);
  const month = ym ? monthGen(ym) : '';
  // a section's share of the month's budget, as in the plan
  const shareOf = (minor: number) => (data?.budget_minor && minor > 0 ? formatPercent(minor, data.budget_minor) : null);
  const saving = data ? savingSum(data) : 0;
  const charges = data ? data.total_minor - saving : 0;
  const upcoming = data ? upcomingOf(data) : null;
  const upcomingCount = upcoming ? upcoming.saving.length + upcoming.plain.length : 0;
  const title = view === 'month' ? `${category.emoji ?? '🔁'} ${category.name}` : `${category.emoji ?? '🔁'} ${w.upcoming}`;
  return (
    <>
    <BottomSheet
      visible={ym !== null} onClose={onClose} title={title} style={styles.root}
      onTitlePress={view === 'month' ? () => { onClose(); openCategory(category.id); } : undefined}
    >
      {!data || !ym ? <Loading inline failed={failed} onRetry={load} /> : (
        <SheetScrollView contentContainerStyle={styles.body}>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>{view === 'month' ? `В плане ${month}` : `Копим ${inMonth(ym)}`}</Text>
            <Text style={styles.factValue}>
              {view === 'upcoming' ? money(saving) : data.planned_minor === null ? '—' : money(data.by_hand ? data.planned_minor : charges)}
            </Text>
          </View>
          {view === 'month' && data.by_hand ? (
            <TouchableOpacity onPress={onEditAmount} accessibilityRole="button">
              <Text style={formStyles.hint}>{`Сумма введена вручную — пока ${w.noneHas} нет даты.`} <Text style={styles.link}>Изменить сумму</Text></Text>
            </TouchableOpacity>
          ) : view === 'month' ? <TextLink label="Изменить в плане" onPress={onEditAmount} style={styles.planLink} containerStyle={styles.planLinkBox} /> : null}
          {view === 'month' ? (
            <MonthPaymentsView
              ym={ym} data={data} w={w} money={money} shareOf={shareOf} chargesMinor={charges} open={setOpen} targetOf={targetOf}
              upcoming={upcomingCount ? { savingMinor: saving, count: upcomingCount } : null}
              merchantTarget={(m) => ({ category, merchant_key: m.merchant_key, name: m.name, amount_minor: m.amount_minor, currency: m.currency, period: 1, due: null, last_day: m.day })}
              onUpcoming={() => setView('upcoming')}
              // the month's operations of the category to pick one from (the filters can be changed there)
              onAdd={() => { onClose(); pickPaymentOperation({ id: category.id, label: `${category.emoji ?? ''} ${category.name}`.trim() }, monthDays(ym)); }}
            />
          ) : (
            <UpcomingPaymentsView
              ym={ym} data={data} w={w} money={money} shareOf={shareOf} savingMinor={saving} chargesMinor={charges}
              open={setOpen} targetOf={targetOf} onMonth={() => setView('month')}
            />
          )}
        </SheetScrollView>
      )}
    </BottomSheet>
    {/* over it: siblings, not inside (each sheet its own window; the topmost draws the toast) */}
    <PaymentSheet target={open} onClose={() => setOpen(null)} onLeave={() => { setOpen(null); onClose(); }} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { maxHeight: '94%' },
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  factLabel: { fontSize: 15, color: colors.muted },
  factValue: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  link: { color: colors.accent },
  planLink: { fontSize: 14 },
  planLinkBox: { alignSelf: 'flex-start', marginTop: 4 },
});
