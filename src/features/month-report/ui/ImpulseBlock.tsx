import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { ImpulseCategory, MonthImpulse } from '@/db/reportImpulse';
import { IMPULSE_TRIGGERS, MOODS } from '@/domain/moods';
import { ImpulseCalendar, ImpulseShare, purchasesByDay } from '@/entities/transaction';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { plural } from '@/shared/lib/format';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import ReportBlock from './ReportBlock';
import { styles as report } from './styles';
import { font, radius, space, weight } from '@/shared/theme/tokens';
import TextLink from '@/shared/ui/TextLink';

/** `month`: the month's report — its purchases on the calendar «Покупки по дням» (the year's — none) */
type Props = { m: MonthImpulse; money: (minor: number) => string; onMark: () => void; page?: boolean; month?: string };

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
export default function ImpulseBlock({ m, money, onMark, page, month }: Props) {
  const withMood = m.moods.reduce((a, x) => a + x.count, 0);
  const top = m.moods[0];
  const topLabel = top ? MOODS.find((x) => x.id === top.mood)?.label.toLowerCase() : null;
  const left = m.asked - m.answered;
  return (
    <ReportBlock
      page={page}
      title="Импульсивные покупки"
      right={
        <Text style={report.blockCaption}>
          отмечено {m.answered} из {m.asked}
        </Text>
      }
    >
      <ImpulseShare s={m} money={money} />
      {top ? (
        <>
          <Text style={styles.heading}>{IMPULSE_TRIGGERS}</Text>
          <View style={styles.moods}>
            {MOODS.map((x) => {
              const n = m.moods.find((y) => y.mood === x.id)?.count ?? 0;
              return (
                <View
                  key={x.id}
                  style={[styles.mood, x.id === top.mood && styles.moodTop, n === 0 && styles.moodNone]}
                  accessibilityLabel={`${x.label}: ${n}`}
                >
                  <Text style={styles.emoji}>{x.emoji}</Text>
                  <Text style={[styles.count, x.id === top.mood && styles.countTop]}>{n}</Text>
                </View>
              );
            })}
          </View>
          <Text style={report.blockCaption}>
            Чаще всего — {topLabel}: {top.count} из {withMood} импульсивных покупок с ответом.
          </Text>
        </>
      ) : null}
      {month && m.rows ? (
        <ImpulseCalendar days={purchasesByDay(m.rows)} today={dayKeyOf(new Date())} money={money} month={month} />
      ) : null}
      {m.categories.length ? (
        <>
          <Text style={styles.heading}>По категориям</Text>
          {m.categories.map((c) => (
            <View key={c.id} style={report.catRow}>
              <View style={report.catText}>
                <Text style={report.catName} numberOfLines={1}>
                  {categoryLabel(c)}
                  {c.over === null ? <Text style={styles.noPlan}>{' без плана '}</Text> : null}
                </Text>
                <Text style={report.catNote}>{categoryNote(c, money)}</Text>
              </View>
              <Masked style={[report.lineValue, styles.sum]}>{money(c.impulsiveSum)}</Masked>
            </View>
          ))}
        </>
      ) : null}
      {left > 0 ? <TextLink label={`Отметить ещё ${purchases(left)}`} onPress={onMark} style={report.link} /> : null}
    </ReportBlock>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: font.secondary, fontWeight: weight.semibold, color: colors.text, marginTop: space[6] },
  moods: { flexDirection: 'row', gap: space[6] },
  mood: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[6],
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moodTop: { borderColor: colors.accent },
  moodNone: { opacity: 0.45 },
  emoji: { fontSize: font.heading },
  count: { fontSize: font.caption, color: colors.muted },
  countTop: { color: colors.text },
  noPlan: { fontSize: font.caption, color: colors.warn, backgroundColor: colors.warnBg },
  sum: { color: colors.impulseText },
});
