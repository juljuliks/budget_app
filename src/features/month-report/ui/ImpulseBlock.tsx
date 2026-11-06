import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { ImpulseCategory, MonthImpulse } from '@/db/reportImpulse';
import { IMPULSE_TRIGGERS, MOODS } from '@/domain/moods';
import { ImpulseShare } from '@/entities/transaction';
import { plural } from '@/shared/lib/format';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import { styles as report } from './styles';

type Props = { m: MonthImpulse; money: (minor: number) => string; onMark: () => void };

const purchases = (n: number) => `${n} ${plural(n, ['покупку', 'покупки', 'покупок'])}`;

/** Under a category: "5 из 8 импульсивные", and against its plan — the overspend and how much of it was impulsive. */
function categoryNote(c: ImpulseCategory, money: (minor: number) => string): string {
  const share = `${c.impulsive} из ${c.answered} импульсивные`;
  if (c.over === null) return share;
  if (c.over === 0) return `${share} · в пределах плана`;
  return `${share} · перерасход ${money(c.over)}, из них ${money(Math.min(c.over, c.impulsiveSum))} — импульсивные`;
}

/**
 * The month's impulsive purchases: "отмечено N из M", the share, what pushed to them (the moods, the most often one
 * outlined), each category's (one not in the plan — «без плана»), "Отметить ещё N покупок ›".
 */
export default function ImpulseBlock({ m, money, onMark }: Props) {
  const withMood = m.moods.reduce((a, x) => a + x.count, 0);
  const top = m.moods[0];
  const topLabel = top ? MOODS.find((x) => x.id === top.mood)?.label.toLowerCase() : null;
  const left = m.asked - m.answered;
  return (
    <View style={report.block}>
      <View style={report.blockHead}>
        <Text style={report.blockTitle}>Импульсивные покупки</Text>
        <Text style={report.blockCaption}>отмечено {m.answered} из {m.asked}</Text>
      </View>
      <ImpulseShare s={m} money={money} />
      {top ? (
        <>
          <Text style={styles.heading}>{IMPULSE_TRIGGERS}</Text>
          <View style={styles.moods}>
            {MOODS.map((x) => {
              const n = m.moods.find((y) => y.mood === x.id)?.count ?? 0;
              return (
                <View key={x.id} style={[styles.mood, x.id === top.mood && styles.moodTop, n === 0 && styles.moodNone]} accessibilityLabel={`${x.label}: ${n}`}>
                  <Text style={styles.emoji}>{x.emoji}</Text>
                  <Text style={[styles.count, x.id === top.mood && styles.countTop]}>{n}</Text>
                </View>
              );
            })}
          </View>
          <Text style={report.blockCaption}>Чаще всего — {topLabel}: {top.count} из {withMood} импульсивных покупок с ответом.</Text>
        </>
      ) : null}
      {m.categories.length ? (
        <>
          <Text style={styles.heading}>По категориям</Text>
          {m.categories.map((c) => (
            <View key={c.id} style={report.catRow}>
              <View style={report.catText}>
                <Text style={report.catName} numberOfLines={1}>
                  {categoryLabel(c)}{c.over === null ? <Text style={styles.noPlan}>{' без плана '}</Text> : null}
                </Text>
                <Text style={report.catNote}>{categoryNote(c, money)}</Text>
              </View>
              <Masked style={[report.lineValue, styles.sum]}>{money(c.impulsiveSum)}</Masked>
            </View>
          ))}
        </>
      ) : null}
      {left > 0 ? (
        <TouchableOpacity onPress={onMark} hitSlop={6}>
          <Text style={report.link}>Отметить ещё {purchases(left)} ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 6 },
  moods: { flexDirection: 'row', gap: 6 },
  mood: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: 'transparent' },
  moodTop: { borderColor: colors.accent },
  moodNone: { opacity: 0.45 },
  emoji: { fontSize: 20 },
  count: { fontSize: 12, color: colors.muted },
  countTop: { color: colors.text },
  noPlan: { fontSize: 12, color: colors.warn, backgroundColor: colors.warnBg },
  sum: { color: colors.impulseText },
});
