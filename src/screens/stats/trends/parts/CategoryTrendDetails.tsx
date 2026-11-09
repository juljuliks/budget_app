import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { MerchantLink } from '@/entities/merchant';
import Masked from '@/shared/ui/Masked';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import type { CategoryTrendView } from '../model/categoryTrendView';
import { WEEKDAYS_DAT } from '@/shared/lib/dates';
import { AVERAGE, BY_WEEKDAY, LEAST, MERCHANTS, MOST, TOTAL, WEEK_LEGEND, WHY } from '../texts';
import { detailStyles as s } from './detailStyles';
import TrendBars from './TrendBars';

/**
 * Under a category's chart: why it moved, its weekdays (this week so far against the usual by the same days, this
 * week's days over the usual ones — a tap says a day's), its months (average, total, least, most), its merchants.
 */
export default function CategoryTrendDetails({ v, why, money }: {
  v: NonNullable<CategoryTrendView>; why: string | null; money: (minor: number) => string;
}) {
  const [day, setDay] = useState<number | null>(null);
  const hidden = useHideAmounts();
  const h = v.habits;
  const bar = h && day !== null ? h.bars[day] : null;
  const cell = (title: string, value: React.ReactNode) => (
    <View style={s.cell}><Text style={s.label}>{title}</Text><Masked style={s.value}>{value}</Masked></View>
  );
  return (
    <>
      {why ? <View style={s.block}><Text style={s.label}>{WHY}</Text><Text style={s.value}>{why}</Text></View> : null}
      {h ? (
        <View style={s.block}>
          <Text style={s.label}>{BY_WEEKDAY}</Text>
          <Text style={s.value}>
            {'Эта неделя: '}<Masked style={s.value}>{money(h.week.cur)}</Masked>
            <Text style={s.label}>{' · обычно '}</Text><Masked style={s.label}>{money(h.week.usual)}</Masked>
            <Text style={s.label}>{h.week.upTo === 6 ? ' за неделю' : ` к ${WEEKDAYS_DAT[(h.week.upTo + 1) % 7]}`}</Text>
          </Text>
          <Text style={s.label}>{`Больше всего — ${h.top} · ${h.share}% трат недели`}</Text>
          <View style={s.chart}><TrendBars bars={h.bars} color={v.category.color} height={80} picked={day} onPick={setDay} /></View>
          <Text style={s.label}>
            {!bar ? WEEK_LEGEND : hidden ? bar.label
              : `${bar.label}: ${bar.value === null ? 'ещё впереди' : money(bar.value)} · обычно ${money(bar.usual ?? 0)}`}
          </Text>
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
          <Text style={s.label}>{MERCHANTS}</Text>
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
