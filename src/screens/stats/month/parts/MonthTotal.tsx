import React from 'react';
import { Text, View } from 'react-native';
import { currentYm, MonthStats } from '@/db/plans';
import { daysInMonth, shortRange } from '@/shared/lib/dateRange';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import Masked, { MaskedTotal } from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import { chart } from '@/shared/theme/theme';
import { overStyle, styles } from './styles';

type Props = { stats: MonthStats; ym: string; plannedAll: number; evenPace?: number };

/**
 * The month against its whole plan (the categories' plan and the share outside it) as one bar, like a section's:
 * the current month with a tick where an even pace would be today.
 */
export default function MonthTotal({ stats, ym, plannedAll, evenPace }: Props) {
  const left = Math.round(plannedAll) - stats.spent_minor;
  const lastDay = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  const money = (minor: number) => formatWithCurrency(minor, stats.currency);
  return (
    <View style={styles.monthBox}>
      <Text style={styles.monthLine}>
        {'Потрачено '}
        <MaskedTotal style={styles.groupTotal} hiddenText={formatPercent(stats.spent_minor, plannedAll)}>
          <Text style={overStyle(stats.spent_minor, plannedAll)}>{formatShort(stats.spent_minor)}</Text>
          <Text style={styles.rowLimit}> / {money(Math.round(plannedAll))}</Text>
          {stats.spent_minor > 0 ? <Text style={[styles.rowLimit, overStyle(stats.spent_minor, plannedAll)]}>{` (${formatPercent(stats.spent_minor, plannedAll)})`}</Text> : null}
        </MaskedTotal>
      </Text>
      {left < 0
        ? <Meter ratio={1} over={plannedAll / stats.spent_minor} height={8} color={chart.meterFill} />
        : <Meter ratio={stats.spent_minor / plannedAll} height={8} color={chart.meterFill} marker={evenPace} />}
      <Text style={styles.rowStatus}>
        {left < 0
          ? <Text style={styles.overLine}>Перерасход <Masked style={styles.overLine}>{money(-left)}</Masked></Text>
          : ym < currentYm()
            ? <>Сэкономлено <Masked style={styles.rowStatus}>{money(left)}</Masked></>
            : <>Осталось <Masked style={styles.rowStatus}>{money(left)}</Masked> · до {shortRange({ from: lastDay, to: lastDay })}</>}
      </Text>
    </View>
  );
}
