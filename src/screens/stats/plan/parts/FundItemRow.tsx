import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { PlanItem } from '@/db/plans';
import { fundProgress, isSaved } from '@/entities/plan';
import { formatWithCurrency } from '@/shared/lib/money';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { styles } from './styles';

type Props = { p: PlanView; item: PlanItem; hidden: boolean; onOpen: () => void };

/**
 * A fund in the plan: a ring of how far along it is in the pin's place, "1 200 из 3 000 ₾ · к 31 июля 2027", the month's
 * contribution; saved up — "можно тратить". A tap opens the fund.
 */
export function FundItemRow({ p, item, hidden, onOpen }: Props) {
  const f = item.fund;
  const saved = f ? isSaved(f.saved_minor, f.target_minor) : false;
  const inBudget = p.fundInBudget(item);
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityLabel={`Копилка: ${categoryLabel(item)}`}>
      <View style={styles.pin}>
        <ProgressRing ratio={f ? f.saved_minor / f.target_minor : 0} color={saved ? colors.income : colors.fund} track={colors.fundTrack} size={22} />
      </View>
      <View style={styles.nameBox}>
        <Text style={styles.name} numberOfLines={1}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
        {f ? (
          <Text style={styles.percent}>
            {hidden ? (saved ? 'накоплено' : `${Math.floor((f.saved_minor / f.target_minor) * 100)}%`) : fundProgress(f.saved_minor, f.target_minor, f.due, item.currency)}
          </Text>
        ) : null}
      </View>
      {hidden ? null : (
        <View style={styles.amountBox}>
          {/* "(385 $)" before it: in the budget's currency, when the screen shows another */}
          <View style={styles.amountLine}>
            {inBudget !== null && p.budgetMoney ? <Text style={[styles.amount, styles.savingForeign]}>{p.budgetMoney(inBudget)}</Text> : null}
            <Text style={styles.amount}>
              {item.converted_minor !== null ? p.money(item.converted_minor) : formatWithCurrency(item.limit_minor, item.currency)}
            </Text>
          </View>
          <Text style={styles.amountOriginal}>{saved && !item.limit_minor ? 'можно тратить' : 'в месяц'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
