import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MerchantLink } from '@/entities/merchant';
import { MONTHS_GEN, MONTHS_PREP, monthYear } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { SubsTrend as Subs, SubTrend } from '@/stats/subsFundTrend';
import type { Bar } from '../model/trendsView';
import { detailStyles as s } from './detailStyles';
import { shortDay } from './RareTrend';
import TrendBars from './TrendBars';

/** Under a subscription's name: it went up, it's gone, its next charge. */
function note(x: SubTrend, next: string | null | undefined, screenMoney: (minor: number) => string): { text: string; warn?: boolean } | null {
  // its change is in its own currency
  const money = x.own ? (minor: number) => formatWithCurrency(minor, x.own!.currency) : screenMoney;
  if (x.gone) return { text: x.lastDay ? `последний платёж ${shortDay(x.lastDay)} · больше не списывается` : 'больше не списывается' };
  if (x.change && x.change.to > x.change.from) return { text: `подорожал с ${MONTHS_GEN[Number(x.change.ym.slice(5)) - 1]}: ${money(x.change.from)} → ${money(x.change.to)}`, warn: true };
  if (next) return { text: `${x.yearly ? 'раз в год · ' : ''}следующее ${shortDay(next)}` };
  return x.yearly ? { text: 'раз в год' } : null;
}

/**
 * «Динамика» of a category with «Подписки»: this month, the 12 months (a yearly one shows as its month's spike), each
 * subscription — a month and a year, gone up, the next charge; one no longer charging — grey, last.
 */
export default function SubsTrend({ t, next, bars, color, money }: {
  t: Subs; next: Map<number, string | null>; bars: Bar[]; color: string; money: (minor: number) => string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const cur = t.bars[t.bars.length - 1];
  const live = t.subs.filter((x) => !x.gone).length;
  const bar = picked === null ? null : t.bars[picked];
  return (
    <>
      <View style={s.head}>
        <Text><Masked style={s.spent}>{money(cur.value)}</Masked><Text style={s.spentWhen}>{` в ${MONTHS_PREP[Number(cur.ym.slice(5)) - 1]}`}</Text></Text>
      </View>
      <Text style={s.line}>{live ? `🔁 ${live} ${plural(live, ['подписка', 'подписки', 'подписок'])}` : 'Подписок пока нет: сделайте подписку из мерчанта на странице категории'}</Text>
      <View style={s.chart}><TrendBars bars={bars} color={color} height={120} picked={picked} onPick={setPicked} /></View>
      <Text style={s.point}>{bar ? `${monthYear(bar.ym)}: ${money(bar.value)}` : 'Нажмите на месяц, чтобы увидеть сумму'}</Text>
      <View style={[s.block, s.grid]}>
        <View style={s.cell}><Text style={s.label}>В среднем в месяц</Text><Masked style={s.value}>{money(t.average)}</Masked></View>
        <View style={s.cell}><Text style={s.label}>За 12 месяцев</Text><Masked style={s.value}>{money(t.total)}</Masked></View>
      </View>
      {t.subs.length ? (
        <View style={s.block}>
          <Text style={s.label}>Подписки</Text>
          {t.subs.map((x) => {
            const n = note(x, next.get(x.id), money);
            return (
              <View key={x.id} style={[styles.sub, x.gone && styles.gone]}>
                <View style={s.merchantName}>
                  {x.merchantKey && !x.gone ? <MerchantLink merchantKey={x.merchantKey} label={x.name} /> : <Text style={s.value}>{x.name}</Text>}
                  {n ? <Text style={[styles.note, n.warn && styles.warn]}>{n.text}</Text> : null}
                </View>
                <View style={styles.right}>
                  {/* in another currency: its own first, the screen's in brackets — "3 $ (7.79 ₾)" */}
                  <Masked style={s.value}>
                    {x.own ? formatWithCurrency(x.own.amount, x.own.currency) : money(x.amount ?? 0)}
                    {x.own && x.amount !== null ? <Text style={styles.inShown}>{` (${money(x.amount)})`}</Text> : null}
                  </Masked>
                  {!x.gone && x.perMonth !== null ? (
                    <Text style={styles.note}>{x.yearly ? `≈ ${money(x.perMonth)} в месяц` : `в месяц · ${money(x.perYear!)} в год`}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sub: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
  gone: { opacity: 0.6 },
  right: { alignItems: 'flex-end' },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  inShown: { color: colors.muted },
  warn: { color: colors.warn },
});
