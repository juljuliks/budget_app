import React from 'react';
import { Text, View } from 'react-native';
import type { YearReport } from '@/db/yearReport';
import Masked from '@/shared/ui/Masked';
import { yearLines } from '../../model/yearView';
import { y } from './styles';

/** «Ваш 2026 в цифрах»: put aside, its share of the budget against the goal, the pace; what came in, was spent, the funds, the plan. */
export default function YearNumbers({ r, page }: { r: YearReport; page?: boolean }) {
  const l = yearLines(r);
  const cells: Array<[string, string]> = [
    ['Пришло', l.money(r.income)], ['Потрачено', l.money(r.spent)], ['В копилки', l.money(r.funds)], ['В плане', l.inPlan],
  ];
  return (
    <View style={y.gap}>
      {/* the year's stats: on top of the page, the year by the arrows over it */}
      {page ? null : <Text style={[y.title, y.center]}>{`Ваш ${r.year} в цифрах`}</Text>}
      <Text style={[y.caption, y.center]}>{l.savedCaption}</Text>
      <Masked style={y.big}>{l.saved(r.saved)}</Masked>
      {l.ofBudget ? <Text style={[y.caption, y.center]}>{l.ofBudget}</Text> : null}
      {l.pace ? <Text style={[y.caption, y.center]}>{l.pace}</Text> : null}
      <View style={y.cells}>
        {cells.map(([label, value]) => (
          <View key={label} style={y.cell}>
            <Text style={y.caption}>{label}</Text>
            <Masked style={y.cellValue}>{value}</Masked>
          </View>
        ))}
      </View>
    </View>
  );
}
