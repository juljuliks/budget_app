import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { Subscription, todayKey } from '@/db/subscriptions';
import { formatWithCurrency } from '@/shared/lib/money';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import Button from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import SectionBand from '@/shared/ui/SectionBand';
import { formatPercent } from '@/shared/lib/format';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { paymentWords } from '@/entities/category';
import { PaymentCategory, SubscriptionTarget } from '../model/useSubscriptionForm';
import { useSubscriptions } from '../model/useSubscriptions';
import { inMonth, inTime, monthGen, periodText, shortDay } from '../texts';
import AddSubscriptionSheet from './AddSubscriptionSheet';
import SubscriptionRow from './SubscriptionRow';
import SubscriptionSheet from './SubscriptionSheet';

type Props = {
  /** the plan's month; null = closed */
  ym: string | null;
  /** the category with "Повторяющиеся платежи" */
  category: PaymentCategory;
  currency: Currency;
  onClose: () => void;
  /** the amount put in by hand (no subscription has a day yet): the plan's sheet of "Подписки" */
  onEditAmount: () => void;
};


const savingSum = (m: { saving: Array<{ converted_minor: number | null }> }) => m.saving.reduce((a, v) => a + (v.converted_minor ?? 0), 0);

/**
 * "Подписки" of the plan's month: "Списания в <месяце>" (done ✓ or the day), "Другие списания" (by the next charge),
 * "Без даты списания" (a tap — set the day); "＋ Добавить подписку" step by step. A tap opens the subscription.
 */
export default function SubscriptionsSheet({ ym, category, currency, onClose, onEditAmount }: Props) {
  const { data, failed, load } = useSubscriptions(ym, currency, category.id);
  const w = paymentWords(category.name);
  const targetOf = (s: Subscription): SubscriptionTarget => ({ ...s, category });
  const [open, setOpen] = useState<SubscriptionTarget | null>(null);
  const [adding, setAdding] = useState<'merchant' | 'form' | null>(null);
  const today = todayKey();
  const money = (minor: number, cur: string = currency) => formatWithCurrency(minor, cur);
  const month = ym ? monthGen(ym) : '';
  // a section's share of the month's budget, as in the plan
  const shareOf = (minor: number) => (data?.budget_minor && minor > 0 ? formatPercent(minor, data.budget_minor) : null);
  return (
    <>
    <BottomSheet visible={ym !== null} onClose={onClose} title={`${category.emoji ?? '🔁'} ${category.name}`} style={styles.root}>
      {!data || !ym ? <Loading inline failed={failed} onRetry={load} /> : (
        <SheetScrollView contentContainerStyle={styles.body}>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>{`В плане ${month}`}</Text>
            <Text style={styles.factValue}>{data.planned_minor === null ? '—' : money(data.planned_minor)}</Text>
          </View>
          {data.saving.length ? (
            <Text style={formStyles.hint}>{`списания ${money(data.total_minor - savingSum(data))} + копим ${money(savingSum(data))}`}</Text>
          ) : null}
          {data.by_hand ? (
            <TouchableOpacity onPress={onEditAmount} accessibilityRole="button">
              <Text style={formStyles.hint}>{`Сумма введена вручную — пока ${w.noneHas} нет даты.`} <Text style={styles.link}>Изменить сумму</Text></Text>
            </TouchableOpacity>
          ) : null}

          <SectionBand title={`Списания ${inMonth(ym)}`} total={money(data.total_minor - savingSum(data))} share={shareOf(data.total_minor - savingSum(data))} />
          {data.charges.length ? data.charges.map((c) => (
            <SubscriptionRow label={w.One}
              key={`${c.sub.id}-${c.day}`} name={c.sub.name} onPress={() => setOpen(targetOf(c.sub))}
              note={[periodText(c.sub.period_months), ...(c.saved ? ['из отложенного'] : []), c.done ? `✓ списано ${shortDay(c.day)}` : [shortDay(c.day), inTime(c.day, today)].filter(Boolean).join(', ')]}
              tone={c.done ? 'ok' : undefined} amount={money(c.sub.amount_minor, c.sub.currency)} muted={c.saved}
            />
          )) : <Text style={formStyles.hint}>{`Нет списаний ${inMonth(ym)}`}</Text>}

          {/* the later ones in the plan: only what is saved up for them this month */}
          {data.later.length ? <SectionBand title="Другие списания" total={savingSum(data) ? `копим ${money(savingSum(data))}` : null} share={shareOf(savingSum(data))} /> : null}
          {data.later.map(({ sub, next }) => {
            const v = data.saving.find((x) => x.sub_id === sub.id);
            return v ? (
              <SubscriptionRow label={w.One}
                key={sub.id} name={sub.name} onPress={() => setOpen(targetOf(sub))} ring={sub.amount_minor ? v.end_minor / sub.amount_minor : 0}
                note={[periodText(sub.period_months), shortDay(next), `${money(v.end_minor, sub.currency)} из ${money(sub.amount_minor, sub.currency)}`]}
                amount={money(v.contribution_minor, sub.currency)} amountNote="в месяц"
              />
            ) : (
              <SubscriptionRow label={w.One}
                key={sub.id} name={sub.name} onPress={() => setOpen(targetOf(sub))}
                note={[periodText(sub.period_months), shortDay(next)]}
                amount={money(sub.amount_minor, sub.currency)} amountNote={inMonth(next.slice(0, 7))} muted
              />
            );
          })}

          {data.undated.length || data.merchants.length ? <SectionBand title="Без даты списания" /> : null}
          {data.undated.map((sub) => (
            <SubscriptionRow label={w.One}
              key={sub.id} name={sub.name} onPress={() => setOpen(targetOf(sub))}
              note={[periodText(sub.period_months), 'Задать дату']} tone="warn" amount={money(sub.amount_minor, sub.currency)}
            />
          ))}
          {data.merchants.map((m) => (
            <SubscriptionRow label={w.One}
              key={m.merchant_key} name={m.name} note={[`последняя ${shortDay(m.day)}`, 'Задать дату']} tone="warn"
              amount={money(m.amount_minor, m.currency)}
              onPress={() => setOpen({ category, merchant_key: m.merchant_key, name: m.name, amount_minor: m.amount_minor, currency: m.currency, period_months: 1, due: null, last_day: m.day })}
            />
          ))}

          <Button title={`＋ ${w.add}`} outline onPress={() => setAdding('merchant')} style={styles.add} />
        </SheetScrollView>
      )}
    </BottomSheet>
    {/* over it: siblings, not inside (each sheet its own window; the topmost draws the toast) */}
    <SubscriptionSheet target={open} onClose={() => { setOpen(null); setAdding(null); }} adding={adding === 'form' ? { onBack: () => { setOpen(null); setAdding('merchant'); } } : undefined} />
      <AddSubscriptionSheet
        visible={adding === 'merchant'} category={category} onClose={() => setAdding(null)}
        onPick={(target) => { setAdding('form'); setOpen(target); }}
      />
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
  add: { marginTop: 16 },
});
