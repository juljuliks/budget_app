import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { YearReport } from '@/db/yearReport';
import { plural } from '@/shared/lib/format';
import { yearBars, yearLines } from '../../model/yearView';
import { y } from './styles';

/**
 * «По месяцам»: a bar a month — what was put aside of its budget, the overspend down; the goal dashed; below it paler; no
 * data — grey, not pressed. A tap — that month's report. The best and the worst month with its main reason.
 */
export default function YearBars({ r, onMonth }: { r: YearReport; onMonth: (ym: string) => void }) {
  const { bars, goalAt, reached } = yearBars(r);
  const l = yearLines(r);
  return (
    <View style={y.gap}>
      <Text style={y.title}>{`${r.planMonths} из ${r.count} ${plural(r.count, ['месяца', 'месяцев', 'месяцев'])} — в плане`}</Text>
      <Text style={y.caption}>
        {`Сколько отложено от бюджета месяца${goalAt !== null ? ` · ${reached} ${plural(reached, ['месяц', 'месяца', 'месяцев'])} — не меньше цели` : ''}`}
      </Text>
      <View style={y.chart}>
        {/* the goal over the upper half (the month labels' row aside: close enough) */}
        {goalAt !== null ? <View style={[y.goal, { top: `${(1 - goalAt) * 45}%` }]} pointerEvents="none" /> : null}
        {bars.map((b) => (
          <TouchableOpacity key={b.ym} style={[y.col, b.grey && y.grey]} disabled={!b.pressable} onPress={() => onMonth(b.ym)}
            accessibilityRole="button" accessibilityLabel={`${b.label}: ${b.pct === null ? '—' : `${b.pct}%`}`}>
            <View style={[y.half, y.up]}>
              {!b.down && b.height > 0 ? <View style={[y.bar, b.pale && y.pale, { height: `${Math.max(2, b.height * 100)}%` }]} /> : null}
            </View>
            <View style={y.axis} />
            <View style={y.half}>
              {b.down ? <View style={[y.bar, y.barDown, { height: `${Math.max(2, b.height * 100)}%` }]} /> : null}
            </View>
            <Text style={y.monthLabel}>{b.grey ? '—' : b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {goalAt !== null ? <Text style={y.caption}>{`Пунктир — цель ${r.goalPct}% («🔒 Отложить сразу» из Настроек); вниз — перерасход бюджета. Нажмите на столбик — отчёт за месяц`}</Text> : null}
      {l.best ? <Line title="Больше всего отложено" note={l.best.title} value={l.best.value} good /> : null}
      {l.worst ? <Line title="Меньше всего" note={l.worst.title} value={l.worst.value} /> : null}
    </View>
  );
}

function Line({ title, note, value, good }: { title: string; note: string; value: string; good?: boolean }) {
  return (
    <View style={y.row}>
      <View style={y.rowText}>
        <Text style={y.name}>{title}</Text>
        <Text style={y.caption}>{note}</Text>
      </View>
      <Text style={[y.value, good ? y.good : y.bad]}>{value}</Text>
    </View>
  );
}
