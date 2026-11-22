import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { YearReport } from '@/db/yearReport';
import { yearTable } from '../../model/yearView';
import { y } from './styles';

/** «Месяц за месяцем»: «Пришло / Потрачено / Отложено / %», «Итого», «Сред.», ▲▼; a tap on a month — its report. */
/** `page`: under the bars of «По месяцам» — no title of its own */
export default function YearTable({ r, onMonth, page }: { r: YearReport; onMonth: (ym: string) => void; page?: boolean }) {
  const t = yearTable(r);
  // the currency over the months' column: «$ | Пришло | Потрачено | Отложено | %»
  const head = [t.unit, 'Пришло', 'Потрачено', 'Отложено', '%'];
  return (
    <View>
      {page ? null : (
        <>
          <Text style={y.title}>Месяц за месяцем</Text>
          <Text style={y.caption}>Нажмите на месяц — его отчёт</Text>
        </>
      )}
      <View style={y.tr}>
        {head.map((h, i) => <Text key={h || 'm'} style={[y.td, y.th, i === 0 && y.tdName, i === 4 && y.tdPct]}>{h}</Text>)}
      </View>
      {t.rows.map((m) => (
        <TouchableOpacity key={m.ym} style={[y.tr, m.grey && y.grey]} disabled={!m.pressable} onPress={() => onMonth(m.ym)} accessibilityRole="button">
          <Text style={[y.td, y.tdName]}>{`${m.mark ? `${m.mark} ` : ''}${m.name}`}</Text>
          <Text style={y.td}>{m.income}</Text>
          <Text style={y.td}>{m.spent}</Text>
          <Text style={y.td}>{m.saved}</Text>
          <Text style={[y.td, y.tdPct]}>{m.pct}</Text>
        </TouchableOpacity>
      ))}
      {([['Итого', t.total], ['Сред.', t.average]] as const).map(([name, cells]) => (
        <View key={name} style={y.tr}>
          <Text style={[y.td, y.tdName, y.strong]}>{name}</Text>
          {cells.map((c, i) => <Text key={i} style={[y.td, y.strong, i === 3 && y.tdPct]}>{c}</Text>)}
        </View>
      ))}
      <Text style={[y.caption, y.note]}>▲ больше всего отложено · ▼ меньше всего; серым — без данных</Text>
    </View>
  );
}
