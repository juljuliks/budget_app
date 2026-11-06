import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IMPULSE_TRIGGERS, MOODS } from '@/domain/moods';
import { MerchantLink } from '@/entities/merchant';
import { ImpulseShare } from '@/entities/transaction';
import { plural } from '@/shared/lib/format';
import { showOperationsFrom } from '@/shared/navigation/navigation';
import Masked from '@/shared/ui/Masked';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import { MIN_ANSWERS } from '@/stats/impulse';
import type { ImpulseTrendView } from '../model/impulseTrendView';
import { detailStyles as s } from './detailStyles';

const BAR_HEIGHT = 40;

/**
 * Under a category's merchants in its «Динамика»: its impulsive purchases of the last 3 months — the share, by month,
 * where most often, what pushed to them; with fewer than MIN_ANSWERS answers, only how many are needed.
 */
export default function ImpulseTrend({ v, categoryId, money }: { v: NonNullable<ImpulseTrendView>; categoryId: number; money: (minor: number) => string }) {
  const mark = v.unanswered > 0 ? (
    <TextLink
      label={`Отметить ${v.unanswered} ${plural(v.unanswered, ['покупку', 'покупки', 'покупок'])}`}
      onPress={() => showOperationsFrom({ category: categoryId, range: v.window, unanswered: true })}
      containerStyle={styles.mark}
    />
  ) : null;
  const head = (
    <View style={styles.head}>
      <Text style={s.label}>Импульсивные покупки · за 3 месяца</Text>
      {v.enough ? <Text style={s.label}>отмечено {v.summary.answered} из {v.summary.asked}</Text> : null}
    </View>
  );
  if (!v.enough) {
    return (
      <View style={s.block}>
        {head}
        <Text style={s.value}>Для анализа нужно {MIN_ANSWERS} ответов, сейчас {v.summary.answered}</Text>
        {mark}
      </View>
    );
  }
  return (
    <>
      <View style={s.block}>
        {head}
        <ImpulseShare s={v.summary} money={money} big />
        {mark}
      </View>
      {v.months ? (
        <View style={s.block}>
          <Text style={s.label}>Доля импульсивных по месяцам</Text>
          <View style={styles.bars}>
            {v.months.map((m) => (
              <View key={m.ym} style={styles.month}>
                <Text style={[styles.pct, m.current && styles.now]}>{m.share === null ? '—' : `${Math.round(m.share * 100)}%`}</Text>
                <View style={[styles.bar, { height: Math.max(2, (m.share ?? 0) * BAR_HEIGHT) }]} />
                <Text style={[styles.pct, m.current && styles.now]}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {v.merchants.length ? (
        <View style={s.block}>
          <Text style={s.label}>Где чаще импульсивно</Text>
          {v.merchants.map((m) => (
            <View key={m.key ?? m.name} style={s.merchant}>
              {m.key ? <MerchantLink merchantKey={m.key} label={m.name} containerStyle={s.merchantName} /> : <Text style={[s.value, s.merchantName]}>{m.name}</Text>}
              <Text style={[s.value, styles.muted]}>{m.impulsive} из {m.answered}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {v.summary.moods.length ? (
        <View style={s.block}>
          <Text style={s.label}>{IMPULSE_TRIGGERS}</Text>
          {v.summary.moods.map((m) => {
            const mood = MOODS.find((x) => x.id === m.mood);
            return (
              <View key={m.mood} style={s.merchant}>
                <Text style={[s.value, s.merchantName]}>{mood ? `${mood.emoji} ${mood.label}` : m.mood}</Text>
                <Text style={[s.value, styles.muted]}>{m.count} · <Masked style={[s.value, styles.muted]}>{money(m.sum)}</Masked></Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  mark: { marginTop: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 8 },
  month: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { alignSelf: 'stretch', backgroundColor: colors.impulse, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  pct: { fontSize: 12, color: colors.muted },
  now: { color: colors.text, fontWeight: '600' },
  muted: { color: colors.muted },
});
