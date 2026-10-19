import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { PlanItem } from '@/db/plans';
import { paymentWords } from '@/entities/category';
import { inTime, periodText, shortDay } from '@/features/recurring-payments';
import { todayKey } from '@/db/recurring';
import { RepeatIcon } from '@/shared/ui/icons';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { styles } from './styles';

type Props = { p: PlanView; item: PlanItem; hidden: boolean; onOpen: () => void };

/**
 * A category with repeating payments in the plan: the repeat sign in the pin's place, its payments with a day by name ("копим: …" — those
 * saved up for), the month's amount (counted from them; by hand until one has a day), "копим 26.67 ₾" — the
 * contributions in it. A tap opens the "Подписки" sheet.
 */
export function RecurringItemRow({ p, item, hidden, onOpen }: Props) {
  const names = item.subs?.names ?? [];
  const saving = item.subs?.saving_names ?? [];
  const listed = [names.join(', '), saving.length ? `копим: ${saving.join(', ')}` : ''].filter(Boolean).join(' · ');
  const w = paymentWords(item.name);
  const one = item.subs?.single;
  // its only payment: how often, paid or when next ("без даты" — the amount stands each month)
  const single = one ? [periodText(one.period),
    one.done && one.day ? `✓ оплачено ${shortDay(one.day)}` : one.day ? [shortDay(one.day), inTime(one.day, todayKey())].filter(Boolean).join(', ') : 'без даты',
  ].join(' · ') : null;
  const note = single ?? (item.kind !== 'subs' ? `вручную · задайте даты ${w.toAll}` : listed || w.noDated);
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityLabel={categoryLabel(item)}>
      <View style={styles.pin}><RepeatIcon color={colors.accent} size={20} /></View>
      <View style={styles.nameBox}>
        <Text style={styles.name} numberOfLines={1}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
        <Text style={styles.percent} numberOfLines={1}>{note}</Text>
      </View>
      {hidden ? null : (
        <View style={styles.amountBox}>
          <Text style={styles.amount}>{item.converted_minor !== null ? p.money(item.converted_minor) : formatWithCurrency(item.limit_minor, item.currency)}</Text>
          {item.subs?.saving_minor ? <Text style={styles.amountOriginal}>{`копим ${p.money(item.subs.saving_minor)}`}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}
