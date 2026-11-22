import React from 'react';
import { Text, View } from 'react-native';
import type { YearReport } from '@/db/yearReport';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import Masked from '@/shared/ui/Masked';
import { longDay, MONTHS_PREP } from '@/shared/lib/dates';
import { y } from './styles';

/** «Запомнилось»: the biggest purchase, the subscriptions (and what got dearer), the most frequent merchant, days without spending. */
export default function YearRemembered({ r }: { r: YearReport }) {
  const money = (v: number) => formatWithCurrency(Math.round(v), r.currency);
  const items: Array<{ title: string; note: string; value?: string }> = [];
  if (r.biggest) items.push({ title: 'Самая большая трата', note: `${r.biggest.label}${r.biggest.merchant ? ` · ${r.biggest.merchant}` : ''} · ${longDay(r.biggest.day)}`, value: money(r.biggest.value) });
  if (r.subs) {
    const raised = r.subs.raised.length ? ` · подорожала ${r.subs.raised.length}: ${r.subs.raised.map((x) => `${x.merchant} +${formatWithCurrency(x.by, x.currency)}`).join(', ')}` : '';
    items.push({ title: 'Подписки', note: `${r.subs.count} ${plural(r.subs.count, ['подписка', 'подписки', 'подписок'])} · ${money(r.subs.perMonth)} в месяц${raised}`, value: money(r.subs.total) });
  }
  if (r.frequent) {
    items.push({ title: 'Чаще всего', note: `${r.frequent.merchant} · ${r.frequent.count} ${plural(r.frequent.count, ['покупка', 'покупки', 'покупок'])} · средний чек ${money(r.frequent.average)}`, value: money(r.frequent.total) });
  }
  if (r.noSpend && r.noSpend.days > 0) {
    const best = r.noSpend.best ? ` · больше всего — в ${MONTHS_PREP[Number(r.noSpend.best.ym.slice(5)) - 1]}, ${r.noSpend.best.days}` : '';
    items.push({ title: 'Дней без трат', note: `${r.noSpend.days} из ${r.noSpend.of}${best}` });
  }
  return (
    <View style={y.gap}>
      <Text style={y.title}>Запомнилось</Text>
      {items.map((i) => (
        <View key={i.title} style={y.row}>
          <View style={y.rowText}>
            <Text style={y.name}>{i.title}</Text>
            <Text style={y.caption}>{i.note}</Text>
          </View>
          {i.value ? <Masked style={y.value}>{i.value}</Masked> : null}
        </View>
      ))}
    </View>
  );
}
