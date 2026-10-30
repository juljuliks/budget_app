import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import { openCategoryTrend } from '@/shared/navigation/navigation';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { colors } from '@/shared/theme/theme';
import { ChevronRightIcon } from '@/shared/ui/icons';
import type { TrendMode } from '@/stats/trends';
import { pctText, TrendRow as Row, whyText } from '../model/trendsView';
import { styles } from './styles';
import TrendBars from './TrendBars';

/**
 * A category of «Больше обычного» / «Меньше обычного»: how much off its usual («+40 ₾»), "105 ₾ · обычно 65 ₾ · +62% к
 * обычному", its bars, why. A tap — its page. «Скрыть суммы»: just the %.
 */
export default function TrendRow({ row, mode, currency }: { row: Row; mode: TrendMode; currency: Currency }) {
  const hidden = useHideAmounts();
  const money = (v: number) => formatWithCurrency(Math.round(Math.abs(v)), currency);
  const t = row.trend;
  const why = hidden ? null : whyText(t, money);
  return (
    <TouchableOpacity style={styles.row} onPress={() => openCategoryTrend(row.category.id, mode)} accessibilityHint="Открыть динамику категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: row.category.color }]} />
        <Text style={styles.name} numberOfLines={1}>{row.label}</Text>
        {hidden ? null : <Text style={styles.delta}>{`${t.delta > 0 ? '+' : '−'}${money(t.delta)}`}</Text>}
        <ChevronRightIcon color={colors.muted} size={16} />
      </View>
      <Text style={styles.line}>{hidden ? pctText(t) : `${money(t.cur)} · обычно ${money(t.usual)} · ${pctText(t)}`}</Text>
      <View style={styles.chart}>
        <TrendBars bars={row.bars} color={row.category.color} height={48} />
      </View>
      {why ? <Text style={styles.why}>{why}</Text> : null}
    </TouchableOpacity>
  );
}
