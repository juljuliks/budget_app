import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { FundStat } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthDays } from '@/shared/lib/dateRange';
import { MONTHS_GEN } from '@/shared/lib/dates';
import { MaskedTotal } from '@/shared/ui/Masked';
import { styles } from './styles';

type Props = {
  f: FundStat; ym: string; currency: string; hidden: boolean;
  openTransactions: (categoryId: number | null, days: ReturnType<typeof monthDays>) => void;
};

/**
 * A fund spent from this month: how much ("1 200 ₾ из копилки"); spent past what it had — "Не хватило 50 ₾ — взяты из
 * бюджета октября". What it has is the plan's and its card's. A tap shows its operations of the month.
 */
export default function FundStatRow({ f, ym, currency, hidden, openTransactions }: Props) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  const month = MONTHS_GEN[Number(ym.slice(5)) - 1];
  return (
    <TouchableOpacity style={styles.row} onPress={() => openTransactions(f.category_id, monthDays(ym))} accessibilityHint="Показать операции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: f.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${f.emoji || ''} ${f.name}`.trim()}</Text>
        <MaskedTotal style={styles.rowAmount} hiddenText="">
          {money(f.spent_minor)}<Text style={styles.rowLimit}> из копилки</Text>
        </MaskedTotal>
      </View>
      {f.shortage_minor > 0 ? (
        <Text style={styles.rowStatus}>
          <Text style={styles.overLine}>{`Не хватило${hidden ? '' : ` ${money(f.shortage_minor)}`} — взяты из бюджета ${month}`}</Text>
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
