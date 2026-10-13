import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { FundStat } from '@/db/plans';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import { monthDays } from '@/shared/lib/dateRange';
import { MONTHS_GEN } from '@/shared/lib/dates';
import { MaskedTotal } from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import { colors } from '@/shared/theme/theme';
import { styles } from './styles';

type Props = {
  f: FundStat; ym: string; currency: string; hidden: boolean;
  openTransactions: (categoryId: number | null, days: ReturnType<typeof monthDays>) => void;
};

/**
 * A fund in the month: spent from it against what it had ("1 200 / 1 200 ₾"), what is left in it; spent past it — "не
 * хватило 50 ₾ — взяты из бюджета октября". A tap shows its operations of the month.
 */
export default function FundStatRow({ f, ym, currency, hidden, openTransactions }: Props) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  const month = MONTHS_GEN[Number(ym.slice(5)) - 1];
  return (
    <TouchableOpacity style={styles.row} onPress={() => openTransactions(f.category_id, monthDays(ym))} accessibilityHint="Показать операции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: f.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${f.emoji || ''} ${f.name}`.trim()}</Text>
        <MaskedTotal style={styles.rowAmount} hiddenText={f.available_minor ? `${Math.round((f.spent_minor / f.available_minor) * 100)}%` : ''}>
          <Text style={f.shortage_minor > 0 ? styles.overNum : undefined}>{formatShort(f.spent_minor)}</Text>
          <Text style={styles.rowLimit}> / {money(f.available_minor)}</Text>
        </MaskedTotal>
      </View>
      {f.shortage_minor > 0
        ? <Meter ratio={1} over={f.available_minor / f.spent_minor} height={6} color={colors.fund} marginTop={6} />
        : <Meter ratio={f.available_minor ? f.spent_minor / f.available_minor : 0} height={6} color={colors.fund} marginTop={6} />}
      <Text style={styles.rowStatus}>
        {f.shortage_minor > 0
          ? <Text style={styles.overLine}>{`Не хватило${hidden ? '' : ` ${money(f.shortage_minor)}`} — взяты из бюджета ${month}`}</Text>
          : f.left_minor > 0 ? (hidden ? 'в копилке ещё есть' : `в копилке ${money(f.left_minor)}`) : 'копилка пуста'}
      </Text>
    </TouchableOpacity>
  );
}
