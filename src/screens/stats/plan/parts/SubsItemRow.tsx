import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { PlanItem } from '@/db/plans';
import { RepeatIcon } from '@/shared/ui/icons';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { styles } from './styles';

type Props = { p: PlanView; item: PlanItem; hidden: boolean; onOpen: () => void };

/**
 * "Подписки" in the plan: the repeat sign in the pin's place, the subscriptions with a day by name, the month's amount
 * (counted from them; by hand until one has a day). A tap opens the "Подписки" sheet.
 */
export function SubsItemRow({ p, item, hidden, onOpen }: Props) {
  const names = item.subs?.names ?? [];
  const note = item.kind !== 'subs' ? 'обязательный платёж · задайте даты подпискам' : names.length ? names.join(', ') : 'нет подписок с датой';
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
        </View>
      )}
    </TouchableOpacity>
  );
}
