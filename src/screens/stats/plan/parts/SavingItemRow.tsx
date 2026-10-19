import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { paymentWords } from '@/entities/category';
import type { PlanItem } from '@/db/plans';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { styles } from './styles';

type Props = { p: PlanView; item: PlanItem; hidden: boolean; onOpen: () => void };

/**
 * What a category saves up for its repeating payments this month, in "Сбережения" like a fund: "Предстоящие подписки"
 * ("… платежи"), a ring of what is saved of their amounts, "копим: Netflix", the month's contribution. A tap opens its payments.
 */
export function SavingItemRow({ p, item, hidden, onOpen }: Props) {
  const s = item.subs!;
  const inBudget = p.savingInBudget(item);
  const w = paymentWords(item.name);
  // "Подписки" — just "Предстоящие подписки"; another category — its name in the line under (its emoji is in the title)
  const of = w.subscriptions ? '' : `${item.name} · `;
  const name = `${item.emoji || ''} ${w.upcoming}`.trim();
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityLabel={name}>
      <View style={styles.pin}>
        <ProgressRing ratio={s.saving_amount_minor ? s.saving_end_minor / s.saving_amount_minor : 0} color={colors.fund} track={colors.fundTrack} size={22} />
      </View>
      <View style={styles.nameBox}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.percent} numberOfLines={1}>{`${of}копим: ${s.saving_names.join(', ')}`}</Text>
      </View>
      {hidden ? null : (
        <View style={styles.amountBox}>
          <View style={styles.amountLine}>
            {inBudget !== null && p.budgetMoney ? <Text style={[styles.amount, styles.savingForeign]}>{p.budgetMoney(inBudget)}</Text> : null}
            <Text style={styles.amount}>{p.money(s.saving_minor)}</Text>
          </View>
          <Text style={styles.amountOriginal}>в месяц</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
