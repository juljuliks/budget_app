import React from 'react';
import { Text, View } from 'react-native';
import { currentYm, MonthStats } from '@/db/plans';
import { daysInMonth, shortRange } from '@/shared/lib/dateRange';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import { MaskedTotal } from '@/shared/ui/Masked';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { capitalize } from '../../period/model/periodText';
import { hiddenLeft } from '../../model/hiddenText';
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
  const hidden = useHideAmounts();
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
        {/* "Скрыть суммы": the overspend just named, what's left as a share of the plan */}
        {left < 0
          ? <Text style={styles.overLine}>Перерасход{hidden ? '' : ` ${money(-left)}`}</Text>
          : ym < currentYm()
            ? (hidden ? capitalize(hiddenLeft(left, plannedAll, 'сэкономлено')) : `Сэкономлено ${money(left)}`)
            : <>{hidden ? capitalize(hiddenLeft(left, plannedAll)) : `Осталось ${money(left)}`} · до {shortRange({ from: lastDay, to: lastDay })}</>}
      </Text>
    </View>
  );
}
