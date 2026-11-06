import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { FundStat, MonthStats } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { monthDays } from '@/shared/lib/dateRange';
import { MONTHS_GEN } from '@/shared/lib/dates';
import { MaskedTotal } from '@/shared/ui/Masked';
import { styles } from './styles';

type Props = {
  f: FundStat; ym: string; currency: string; hidden: boolean;
  openTransactions: (categoryId: number | null, days: ReturnType<typeof monthDays>) => void;
  onLongPress?: () => void;
};

/**
 * Under a fund's part of «Сбережения»: what was spent from it this month, in its own currency ("потрачено 44.78 $ из
 * копилки"); past what it had — "Не хватило 10 $ — взяты из бюджета ноября".
 */
export function FundSpent({ f, ym, currency, hidden }: { f: FundStat; ym: string; currency: string; hidden: boolean }) {
  const money = (minor: number) => formatWithCurrency(minor, f.own?.currency ?? currency);
  const spent = f.own?.spent_minor ?? f.spent_minor;
  const shortage = f.own?.shortage_minor ?? f.shortage_minor;
  const month = MONTHS_GEN[Number(ym.slice(5)) - 1];
  return (
    <>
      <Text style={styles.rowStatus}>{hidden ? 'потрачено из копилки' : `потрачено ${money(spent)} из копилки`}</Text>
      {shortage > 0 ? (
        <Text style={styles.rowStatus}>
          <Text style={styles.overLine}>{`Не хватило${hidden ? '' : ` ${money(shortage)}`} — взяты из бюджета ${month}`}</Text>
        </Text>
      ) : null}
    </>
  );
}

/** What is shown under a fund's part of «Сбережения»: FundSpent, when it was spent from this month. */
export const fundSpentOf = (stats: MonthStats, ym: string, hidden: boolean) => (id: number) => {
  const f = stats.funds.find((x) => x.category_id === id && x.spent_minor > 0);
  return f ? <FundSpent f={f} ym={ym} currency={stats.currency} hidden={hidden} /> : undefined;
};

/**
 * A fund spent from this month, not in «Сбережения» (a month without a budget or a contribution): how much ("1 200 ₾ из копилки"); spent past what it had — "Не хватило 50 ₾ — взяты из
 * бюджета октября" (in its own currency). What it has is the plan's and its card's. A tap shows its operations of the month.
 */
export default function FundStatRow({ f, ym, currency, hidden, openTransactions, onLongPress }: Props) {
  const money = (minor: number) => formatWithCurrency(minor, f.own?.currency ?? currency);
  // a fund in another currency than the stats': in its own
  const spent = f.own?.spent_minor ?? f.spent_minor;
  const shortage = f.own?.shortage_minor ?? f.shortage_minor;
  const month = MONTHS_GEN[Number(ym.slice(5)) - 1];
  return (
    <TouchableOpacity style={styles.row} onPress={() => openTransactions(f.category_id, monthDays(ym))} onLongPress={onLongPress} accessibilityHint="Показать операции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: f.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${f.emoji || ''} ${f.name}`.trim()}</Text>
        <MaskedTotal style={styles.rowAmount} hiddenText="">
          {money(spent)}<Text style={styles.rowLimit}> из копилки</Text>
        </MaskedTotal>
      </View>
      {shortage > 0 ? (
        <Text style={styles.rowStatus}>
          <Text style={styles.overLine}>{`Не хватило${hidden ? '' : ` ${money(shortage)}`} — взяты из бюджета ${month}`}</Text>
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
