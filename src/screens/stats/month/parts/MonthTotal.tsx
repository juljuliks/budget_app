import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { currentYm, MonthStats, PaymentMark } from '@/db/plans';
import { dayKeyOf, daysInMonth, shortRange } from '@/shared/lib/dateRange';
import { formatWithCurrency } from '@/shared/lib/money';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { capitalize } from '../../period/model/periodText';
import { hiddenLeft } from '../../model/hiddenText';
import Meter from '@/shared/ui/Meter';
import { chart } from '@/shared/theme/theme';
import { monthPace, ShownMark } from '../model/monthPace';
import BarMarks from './BarMarks';
import MarkInfo from './MarkInfo';
import { markStyles } from './markStyles';
import { styles } from './styles';

type Props = {
  stats: MonthStats; ym: string; plannedAll: number; evenPace?: number;
  /** the month's payments with a day: their marks over the bar, today's tick counting them */
  marks?: PaymentMark[];
};

/**
 * The month against its whole plan (the categories' plan and the share outside it) as one bar, like a section's (how
 * much of it — in the donut's hole):
 * the current month with a tick where the plan expects the spending today (evenly, the payments with a day — whole on
 * their day). Over it the payments with a day (BarMarks); one past its day and not paid — named under it. A tap on a
 * mark names its payments instead of "Осталось" (MarkInfo).
 */
export default function MonthTotal({ stats, ym, plannedAll, evenPace, marks = [] }: Props) {
  const left = Math.round(plannedAll) - stats.spent_minor;
  const hidden = useHideAmounts();
  const lastDay = `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`;
  const money = (minor: number) => formatWithCurrency(minor, stats.currency);
  const current = ym === currentYm();
  // a mark tapped: its payments instead of «Осталось …»
  const [picked, setPicked] = useState<ShownMark | null>(null);
  useEffect(() => { setPicked(null); }, [ym]);
  const until = shortRange({ from: lastDay, to: lastDay });
  // the days left, today too; in whole units of the currency
  const perDay = current && left > 0 ? Math.round(left / (daysInMonth(ym) - new Date().getDate() + 1) / 100) * 100 : 0;
  const pace = monthPace(stats, plannedAll - stats.planned_minor, marks, dayKeyOf(new Date()));
  // past the plan the bar is the spending: the marks scaled to it
  const scale = left < 0 ? plannedAll / stats.spent_minor : 1;
  const missed = pace.marks.filter((m) => m.status === 'missed');
  const status = (
    <Text style={styles.rowStatus}>
      {/* "Скрыть суммы": the overspend just named, what's left as a share of the plan */}
      {left < 0
        ? <Text style={styles.overLine}>Перерасход{hidden ? '' : ` ${money(-left)}`}</Text>
        : ym < currentYm()
          ? (hidden ? capitalize(hiddenLeft(left, plannedAll, 'сэкономлено')) : `Сэкономлено ${money(left)}`)
          // the current month: what's left a day till its end, «≈ 12 ₾ в день до 30 ноя»
          : <>{hidden ? capitalize(hiddenLeft(left, plannedAll)) : `Осталось ${money(left)}`} · {perDay && !hidden ? `≈ ${money(perDay)} в день ` : ''}до {until}</>}
    </Text>
  );
  return (
    <View style={styles.monthBox}>
      {pace.marks.length ? <BarMarks marks={pace.marks.map((m) => ({ ...m, at: m.at * scale }))} picked={picked?.key} onPick={setPicked} /> : null}
      {left < 0
        ? <Meter ratio={1} over={plannedAll / stats.spent_minor} height={8} color={chart.meterFill} marginTop={pace.marks.length ? 0 : 8} />
        : <Meter ratio={stats.spent_minor / plannedAll} height={8} color={chart.meterFill} marker={pace.tick ?? evenPace} marginTop={pace.marks.length ? 0 : 8} />}
      {/* a mark tapped: its payments instead of the status */}
      {picked ? <MarkInfo marks={picked.members} money={hidden ? null : (minor) => money(minor)} onClose={() => setPicked(null)} /> : status}
      {missed.map((m) => (
        <Text key={m.key} style={markStyles.missedLine}>
          {`${m.emoji} ${m.name}${hidden ? '' : ` ${money(Math.round(m.minor))}`} — ${shortRange({ from: m.day, to: m.day })}, не оплачен`}
        </Text>
      ))}
    </View>
  );
}
