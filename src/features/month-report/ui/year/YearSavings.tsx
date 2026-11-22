import React from 'react';
import { Text, View } from 'react-native';
import type { YearReport } from '@/db/yearReport';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import Masked from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import { colors } from '@/shared/theme/theme';
import { fundNote } from '../../model/yearView';
import { y } from './styles';

/** «Сбережения: план и факт» of the closed months, and the funds with what each has. */
export default function YearSavings({ r }: { r: YearReport }) {
  const money = (v: number) => formatWithCurrency(Math.round(v), r.currency);
  const s = r.savings;
  const rows: Array<[string, { plan: number; fact: number }]> = s ? [
    ['🔒 Отложено сразу', s.locked], ['💰 Сэкономлено', s.rest], ['Взносы в копилки', s.funds], ['Всего', s.total],
  ] : [];
  return (
    <View style={y.gap}>
      <Text style={y.title}>Сбережения: план и факт</Text>
      {s ? (
        <>
          <Text style={y.caption}>{`По итогам ${s.months} мес.`}</Text>
          <View style={y.tr}><Text style={[y.td, y.th, y.tdName]} /><Text style={[y.td, y.th]}>План</Text><Text style={[y.td, y.th]}>Факт</Text></View>
          {rows.filter(([, v]) => v.plan > 0 || v.fact > 0).map(([name, v]) => (
            <View key={name} style={y.tr}>
              <Text style={[y.td, y.tdName, name === 'Всего' && y.strong]}>{name}</Text>
              <Masked style={[y.td, name === 'Всего' && y.strong]}>{money(v.plan)}</Masked>
              <Masked style={[y.td, v.fact < v.plan ? y.bad : y.good, name === 'Всего' && y.strong]}>{money(v.fact)}</Masked>
            </View>
          ))}
        </>
      ) : <Text style={y.caption}>Итоги месяцев этого года ещё не подведены.</Text>}
      {r.fundsNow.length ? <Text style={[y.name, y.strong]}>Копилки</Text> : null}
      {r.fundsNow.map((f) => (
        <View key={f.id} style={y.fund}>
          <View style={y.row}>
            <Text style={[y.name, y.rowText]} numberOfLines={1}>{f.label}</Text>
            <Masked style={y.value}>{`${formatShort(f.saved)} из ${formatWithCurrency(f.target, f.currency)}`}</Masked>
          </View>
          <Meter ratio={f.target > 0 ? Math.min(1, f.saved / f.target) : 0} height={6} color={f.ok === false ? colors.warn : colors.fund} />
          <Text style={y.caption}>{fundNote(f)}</Text>
        </View>
      ))}
    </View>
  );
}
