import React from 'react';
import { Text, View } from 'react-native';
import type { YearReport } from '@/db/yearReport';
import { formatWithCurrency } from '@/shared/lib/money';
import Masked from '@/shared/ui/Masked';
import { topNote } from '../../model/yearView';
import { y } from './styles';

/** «Куда ушло»: the year's spending, a month on average, the biggest categories and how often they went past their plan. */
export default function YearWhere({ r }: { r: YearReport }) {
  const money = (v: number) => formatWithCurrency(Math.round(v), r.currency);
  return (
    <View style={y.gap}>
      <Text style={y.title}>{`Куда ушло ${money(r.spent)}`}</Text>
      {r.count ? <Text style={y.caption}>{`В среднем ${money(r.spent / r.count)} в месяц`}</Text> : null}
      {r.top.map((c) => (
        <View key={c.id} style={y.row}>
          <View style={y.rowText}>
            <Text style={y.name} numberOfLines={1}>{c.label}</Text>
            <Text style={y.caption}>{topNote(c, money)}</Text>
          </View>
          <Masked style={y.value}>{money(c.sum)}</Masked>
        </View>
      ))}
    </View>
  );
}
