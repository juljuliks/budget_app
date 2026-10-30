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
import BudgetLegend from './BudgetLegend';
import { styles } from './styles';

type Props = { p: PlanView; budget: PlanBudget | null; currency: Currency; hidden: boolean; onEdit: () => void };

/**
 * The budget in one line, then its split as one bar: planned / for spending outside the plan / the funds / savings (or
 * not distributed); under it a line for each part, as a legend (BudgetLegend).
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
            {/* the leftover the month before moved in */}
            {p.budgetSub ? <Masked style={[styles.budgetOriginal, styles.freeValue]}>{p.budgetSub}</Masked> : null}
          </View>
          {hidden ? null : <View style={styles.pencil}><PencilIcon color={colors.accent} size={18} /></View>}
        </TouchableOpacity>
      </View>

      {shownBudget ? (
        <>
          <BudgetBar p={p} />
          <BudgetLegend p={p} />
        </>
      ) : (
        <Text style={[styles.caption, styles.left]}>
          {p.total > 0 ? `Запланировано ${p.money(p.total)}. ` : ''}Укажите бюджет месяца (например, зарплату): план не сможет его превысить, а у категорий появятся доли в %
        </Text>
      )}
    </View>
  );
}
