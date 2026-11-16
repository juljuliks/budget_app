import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { currentYm, MonthStats, PaymentMark } from '@/db/plans';
import { dayKeyOf, daysInMonth, shortRange } from '@/shared/lib/dateRange';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import { MaskedTotal } from '@/shared/ui/Masked';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { capitalize } from '../../period/model/periodText';
import { hiddenLeft } from '../../model/hiddenText';
import Meter from '@/shared/ui/Meter';
import { chart } from '@/shared/theme/theme';
import { monthBreakdown } from '../model/monthBreakdown';
import { monthPace } from '../model/monthPace';
import BarMarks from './BarMarks';
import MonthTiles from './MonthTiles';
import { markStyles } from './markStyles';
import { overStyle, styles } from './styles';

type Props = {
  stats: MonthStats; ym: string; plannedAll: number; evenPace?: number; onEditPlan?: () => void;
  /** the month's payments with a day: their marks over the bar, today's tick counting them */
  marks?: PaymentMark[];
};

/**
 * The month against its whole plan (the categories' plan and the share outside it) as one bar, like a section's:
 * the current month with a tick where the plan expects the spending today (evenly, the payments with a day — whole on
 * their day). Over it the payments with a day (BarMarks); one past its day and not paid — named under it. The current
 * month: under it three tiles — the payments ahead, the limits left, the overspends (MonthTiles).
 */
export default function MonthTotal({ stats, ym, plannedAll, evenPace, onEditPlan, marks = [] }: Props) {
  const left = Math.round(plannedAll) - stats.spent_minor;
  const hidden = useHideAmounts();
  const lastDay = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  const money = (minor: number) => formatWithCurrency(minor, stats.currency);
  const current = ym === currentYm();
  const until = shortRange({ from: lastDay, to: lastDay });
  const pace = monthPace(stats, plannedAll - stats.planned_minor, marks, dayKeyOf(new Date()));
  // past the plan the bar is the spending: the marks scaled to it
  const scale = left < 0 ? plannedAll / stats.spent_minor : 1;
  const missed = pace.marks.filter((m) => m.status === 'missed');
  // a payment not paid yet: its day, in the tiles' list
  const dueOf = new Map<number, string>();
  for (const m of pace.marks) if (m.status !== 'paid' && !dueOf.has(m.category_id)) dueOf.set(m.category_id, shortRange({ from: m.day, to: m.day }));
  const status = (
    <Text style={styles.rowStatus}>
      {/* "Скрыть суммы": the overspend just named, what's left as a share of the plan */}
      {left < 0
        ? <Text style={styles.overLine}>Перерасход{hidden ? '' : ` ${money(-left)}`}</Text>
        : ym < currentYm()
          ? (hidden ? capitalize(hiddenLeft(left, plannedAll, 'сэкономлено')) : `Сэкономлено ${money(left)}`)
          : <>{hidden ? capitalize(hiddenLeft(left, plannedAll)) : `Осталось ${money(left)}`} · до {until}</>}
    </Text>
  );
  return (
    <View style={styles.monthBox}>
      <View style={styles.monthTopRow}>
        <Text style={styles.monthLine}>
          {'Потрачено '}
          <MaskedTotal style={styles.groupTotal} hiddenText={formatPercent(stats.spent_minor, plannedAll)}>
            <Text style={overStyle(stats.spent_minor, plannedAll)}>{formatShort(stats.spent_minor)}</Text>
            <Text style={styles.rowLimit}> / {money(Math.round(plannedAll))}</Text>
            {stats.spent_minor > 0 ? <Text style={[styles.rowLimit, overStyle(stats.spent_minor, plannedAll)]}>{` · ${formatPercent(stats.spent_minor, plannedAll)}`}</Text> : null}
          </MaskedTotal>
        </Text>
        {onEditPlan ? <TouchableOpacity onPress={onEditPlan} hitSlop={8} accessibilityRole="button"><Text style={styles.planLink}>Изменить план ›</Text></TouchableOpacity> : null}
      </View>
      {pace.marks.length ? <BarMarks marks={pace.marks.map((m) => ({ ...m, at: m.at * scale }))} /> : null}
      {left < 0
        ? <Meter ratio={1} over={plannedAll / stats.spent_minor} height={8} color={chart.meterFill} marginTop={pace.marks.length ? 0 : 8} />
        : <Meter ratio={stats.spent_minor / plannedAll} height={8} color={chart.meterFill} marker={pace.tick ?? evenPace} marginTop={pace.marks.length ? 0 : 8} />}
      {status}
      {missed.map((m) => (
        <Text key={m.key} style={markStyles.missedLine}>
          {`${m.emoji} ${m.name}${hidden ? '' : ` ${money(Math.round(m.minor))}`} — ${shortRange({ from: m.day, to: m.day })}, не оплачен`}
        </Text>
      ))}
      {current ? (
        <MonthTiles
          b={monthBreakdown(stats, plannedAll - stats.planned_minor, { day: new Date().getDate(), days: daysInMonth(ym) })}
          currency={stats.currency} until={until} dueOf={dueOf}
        />
      ) : null}
    </View>
  );
}
