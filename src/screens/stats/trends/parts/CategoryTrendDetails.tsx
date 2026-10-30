import React from 'react';
import { Text, View } from 'react-native';
import { MerchantLink } from '@/entities/merchant';
import type { TrendMode } from '@/stats/trends';
import Masked from '@/shared/ui/Masked';
import type { CategoryTrendView } from '../model/categoryTrendView';
import { AVERAGE, BY_WEEKDAY, LEAST, MERCHANTS, MOST, TOTAL, WHY } from '../texts';
import { detailStyles as s } from './detailStyles';
import TrendBars from './TrendBars';

/** Under a category's chart: why it moved, its weekdays, its months (average, total, least, most), its merchants. */
export default function CategoryTrendDetails({ v, mode, why, money }: {
  v: NonNullable<CategoryTrendView>; mode: TrendMode; why: string | null; money: (minor: number) => string;
}) {
  const cell = (title: string, value: React.ReactNode) => (
    <View style={s.cell}><Text style={s.label}>{title}</Text><Masked style={s.value}>{value}</Masked></View>
  );
  return (
    <>
      {why ? <View style={s.block}><Text style={s.label}>{WHY}</Text><Text style={s.value}>{why}</Text></View> : null}
      {v.habits ? (
        <View style={s.block}>
          <Text style={s.label}>{BY_WEEKDAY}</Text>
          <Text style={s.value}>{`Больше всего — ${v.habits.top} · ${v.habits.share}% трат недели`}</Text>
          <View style={s.chart}><TrendBars bars={v.habits.bars} color={v.category.color} height={56} /></View>
        </View>
      ) : null}
      {v.summary ? (
        <View style={[s.block, s.grid]}>
          {cell(AVERAGE, money(v.summary.average))}
          {cell(TOTAL, money(v.summary.total))}
          {cell(LEAST, `${v.summary.least.name} · ${money(v.summary.least.value)}`)}
          {cell(MOST, `${v.summary.most.name} · ${money(v.summary.most.value)}`)}
        </View>
      ) : null}
      {v.merchants.length > 0 ? (
        <View style={s.block}>
          <Text style={s.label}>{MERCHANTS[mode]}</Text>
          {v.merchants.map((m) => (
            <View key={m.key ?? m.name} style={s.merchant}>
              {m.key ? <MerchantLink merchantKey={m.key} label={m.name} containerStyle={s.merchantName} /> : <Text style={[s.value, s.merchantName]}>{m.name}</Text>}
              <Masked style={s.value}>{money(m.value)}</Masked>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}
