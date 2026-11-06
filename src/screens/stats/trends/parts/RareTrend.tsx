import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { MerchantLink } from '@/entities/merchant';
import { MONTHS_GEN, MONTHS_PREP, SHORT_MONTHS } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { showOperationsFrom } from '@/shared/navigation/navigation';
import Masked from '@/shared/ui/Masked';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import type { RareTrend as Rare } from '@/stats/trendKind';
import type { Bar } from '../model/trendsView';
import { detailStyles as s } from './detailStyles';
import TrendBars from './TrendBars';

export const shortDay = (k: string) => `${Number(k.slice(8))} ${SHORT_MONTHS[Number(k.slice(5, 7)) - 1]}`;
const monthGen = (ym: string) => MONTHS_GEN[Number(ym.slice(5)) - 1];
/** shown in the list; the rest — «Все N платежей ›» */
const LIST = 5;

/**
 * «Динамика» of a rare category (1–2 operations a month or fewer): this month, the 12 months, and — the amount nearly
 * the same (rent) — «Подорожал», when it's charged, each payment against the one before; amounts apart (a dentist) —
 * how often, its merchants. No weeks, no weekdays, no «Почему».
 */
export default function RareTrend({ r, bars, color, categoryId, money }: {
  r: Rare; bars: Bar[]; color: string; categoryId: number; money: (minor: number) => string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const cur = r.bars[r.bars.length - 1];
  const last = r.payments[0];
  const word = r.stable ? 'платёж' : 'трата';
  const cell = (title: string, value: string) => (
    <View style={s.cell}><Text style={s.label}>{title}</Text><Masked style={s.value}>{value}</Masked></View>
  );
  const merchants = new Map<string, { key: string | null; name: string; value: number }>();
  for (const p of r.payments) {
    if (!p.merchant) continue;
    const m = merchants.get(p.merchantKey ?? p.merchant) ?? { key: p.merchantKey, name: p.merchant, value: 0 };
    m.value += p.value;
    merchants.set(p.merchantKey ?? p.merchant, m);
  }
  const bar = picked === null ? null : r.bars[picked];
  return (
    <>
      <View style={s.head}>
        <Text><Masked style={s.spent}>{money(cur.value)}</Masked><Text style={s.spentWhen}>{` в ${MONTHS_PREP[Number(cur.ym.slice(5)) - 1]}`}</Text></Text>
      </View>
      {last ? <Text style={s.line}>{`последн${r.stable ? 'ий' : 'яя'} ${word} ${shortDay(last.day)} · `}<Masked style={s.line}>{money(last.value)}</Masked></Text> : null}
      <View style={s.chart}><TrendBars bars={bars} color={color} height={120} picked={picked} onPick={setPicked} /></View>
      <Text style={s.point}>{bar ? `${monthGen(bar.ym).replace(/^./, (c) => c.toUpperCase())}: ${money(bar.value)}` : 'Нажмите на месяц, чтобы увидеть сумму'}</Text>
      {r.change ? (
        <View style={s.block}>
          <Text style={s.label}>{r.change.to > r.change.from ? 'Подорожал' : 'Подешевел'}</Text>
          <Text style={[s.value, r.change.to > r.change.from && { color: colors.warn }]}>
            {`${r.change.to > r.change.from ? '+' : '−'}${money(Math.abs(r.change.to - r.change.from))} с ${monthGen(r.change.ym)}: было ${money(r.change.from)}, стало ${money(r.change.to)}`}
          </Text>
        </View>
      ) : null}
      <View style={[s.block, s.grid]}>
        {cell('В среднем в месяц', money(r.average))}
        {cell('За 12 месяцев', money(r.total))}
        {r.stable ? cell('Платежей', `${r.paidMonths} из 12 месяцев`) : cell('Трат', `${r.payments.length} за 12 месяцев`)}
        {r.stable && r.days ? cell('Обычно списывается', r.days.from === r.days.to ? `${r.days.from} числа` : `${r.days.from}–${r.days.to} числа`) : null}
        {!r.stable && r.every ? cell('Обычно', r.every === 1 ? 'раз в месяц' : `раз в ${r.every} ${plural(r.every, ['месяц', 'месяца', 'месяцев'])}`) : null}
      </View>
      {r.payments.length ? (
        <View style={s.block}>
          <Text style={s.label}>{r.stable ? 'Платежи' : 'Траты'}</Text>
          {r.payments.slice(0, LIST).map((p, i) => {
            const prev = r.payments[i + 1];
            const delta = r.stable && prev && Math.abs(p.value - prev.value) > prev.value * 0.02 ? p.value - prev.value : 0;
            return (
              <View key={p.tx ?? `${p.day}${i}`} style={s.merchant}>
                <Text style={[s.value, s.merchantName]} numberOfLines={1}>{`${shortDay(p.day)} · ${p.merchant ?? '—'}`}</Text>
                <Text style={s.value}>
                  <Masked style={s.value}>{money(p.value)}</Masked>
                  {delta ? <Text style={{ color: delta > 0 ? colors.warn : colors.income }}>{` ${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}`}</Text> : null}
                </Text>
              </View>
            );
          })}
          {r.payments.length > LIST ? (
            <TextLink
              label={`Все ${r.payments.length} ${plural(r.payments.length, r.stable ? ['платёж', 'платежа', 'платежей'] : ['трата', 'траты', 'трат'])}`}
              onPress={() => showOperationsFrom({ category: categoryId, range: { from: `${r.bars[0].ym}-01`, to: r.payments[0].day } })}
              containerStyle={{ marginTop: 10 }}
            />
          ) : null}
        </View>
      ) : null}
      {!r.stable && merchants.size ? (
        <View style={s.block}>
          <Text style={s.label}>Мерчанты за 12 месяцев</Text>
          {[...merchants.values()].sort((a, b) => b.value - a.value).slice(0, 3).map((m) => (
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
