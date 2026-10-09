import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Currency } from '@/db/fx';
import type { PlanBudget } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { PencilIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import BudgetBar from './BudgetBar';
import { RING_LOCKED } from './palette';
import { styles, toneStyle } from './styles';

type Props = { p: PlanView; budget: PlanBudget | null; currency: Currency; hidden: boolean; onEdit: () => void };

/**
 * The budget in one line, then its split as one bar: planned / for spending outside the plan / savings (or not
 * distributed), each part's amount under it in its color.
 */
export default function BudgetCard({ p, budget, currency, hidden, onEdit }: Props) {
  const { shownBudget, locked, free } = p;
  return (
    <View style={styles.budgetBox}>
      <View style={styles.budgetHead}>
        <Text style={styles.caption}>Бюджет месяца</Text>
        <TouchableOpacity style={styles.budgetRow} onPress={onEdit} accessibilityLabel="Изменить бюджет месяца">
          {/* the amount it was entered in, just the number, right under the converted one */}
          <View style={styles.budgetAmounts}>
            <Masked style={styles.budgetValue}>{p.money(shownBudget ?? 0)}</Masked>
            {budget && budget.currency !== currency ? (
              <Masked style={styles.budgetOriginal}>{formatWithCurrency(budget.amount_minor, budget.currency)}</Masked>
            ) : null}
          </View>
          {hidden ? null : <View style={styles.pencil}><PencilIcon color={colors.accent} size={18} /></View>}
        </TouchableOpacity>
      </View>

      {shownBudget ? (
        <>
          <BudgetBar p={p} />
          <View style={styles.parts}>
            {/* no share for spending outside the plan: no column for it */}
            {p.parts.filter((x) => x.key !== 'unplanned' || p.unplanned > 0).map((x) => (
              <View key={x.key} style={styles.part}>
                <View style={styles.legend}>
                  {/* savings holding both the leftover and the locked part: two dots, the locked one over the other */}
                  {x.key === 'free' && locked > 0 && (free ?? 0) > 0 ? (
                    <View style={styles.legendPair}>
                      <View style={[styles.legendDot, { backgroundColor: x.color }]} />
                      <View style={[styles.legendDot, styles.legendOver, { backgroundColor: RING_LOCKED }]} />
                    </View>
                  ) : <View style={[styles.legendDot, { backgroundColor: x.key === 'free' && locked > 0 ? RING_LOCKED : x.color }]} />}
                  <Text style={styles.partLabel} numberOfLines={1}>{x.label}</Text>
                </View>
                <Masked style={[styles.partValue, toneStyle(x.tone)]}>{p.money(x.value)}</Masked>
                <Text style={[styles.partNote, toneStyle(x.noteTone)]} numberOfLines={2}>{x.note}</Text>
              </View>
            ))}
          </View>
          {/* under the bar only the savings forecast, once an overspend makes it smaller */}
          {p.notes.map((n) => <Text key={n.text} style={[styles.note, n.warn && styles.overText]}>{n.text}</Text>)}
        </>
      ) : (
        <Text style={[styles.caption, styles.left]}>
          {p.total > 0 ? `Запланировано ${p.money(p.total)}. ` : ''}Укажите бюджет месяца (например, зарплату): план не сможет его превысить, а у категорий появятся доли в %
        </Text>
      )}
    </View>
  );
}
