import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MOODS } from '@/domain/moods';
import { openTransaction } from '@/shared/navigation/navigation';
import Masked from '@/shared/ui/Masked';
import { chart, colors } from '@/shared/theme/theme';
import { dayCardTitle, DayPurchase, Mark } from '../model/impulseCalendarView';
import { MARK_TEXTS } from '../model/impulseTexts';
import { font, radius, space, weight } from '@/shared/theme/tokens';

const KIND_COLOR: Record<Mark, string> = {
  impulsive: colors.impulseText,
  intentional: chart.meterFill,
  unanswered: colors.muted,
};

function kindText(p: DayPurchase): string {
  const mood = p.mark === 'impulsive' ? MOODS.find((m) => m.id === p.mood) : undefined;
  return mood ? `${MARK_TEXTS.impulsive} · ${mood.emoji} ${mood.label}` : MARK_TEXTS[p.mark];
}

/** A tapped day of «Покупки по дням»: its purchases in the category — merchant, answer, amount; a tap opens the operation. */
export default function ImpulseDayCard({
  day,
  purchases,
  money,
}: {
  day: string;
  purchases: DayPurchase[];
  money: (minor: number) => string;
}) {
  const sum = purchases.reduce((s, p) => s + p.value, 0);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{dayCardTitle(day)}</Text>
        <Masked style={styles.sum}>{money(sum)}</Masked>
      </View>
      {purchases.map((p, i) => (
        <TouchableOpacity
          key={p.tx}
          style={[styles.row, i > 0 && styles.divider]}
          onPress={() => openTransaction(p.tx)}
          accessibilityRole="button"
        >
          <View style={styles.main}>
            <Text style={styles.merchant} numberOfLines={1}>
              {p.merchant ?? 'Без мерчанта'}
            </Text>
            <Text style={[styles.kind, { color: KIND_COLOR[p.mark] }]}>{kindText(p)}</Text>
          </View>
          <Masked style={styles.amount}>{money(p.value)}</Masked>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space[12],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space[14],
    paddingTop: space[10],
    paddingBottom: space[2],
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[8] },
  title: { fontSize: font.meta, color: colors.muted },
  sum: { fontSize: font.secondary, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[10], minHeight: 48, paddingVertical: space[8] },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  main: { flex: 1 },
  merchant: { fontSize: font.input, color: colors.text },
  kind: { fontSize: font.meta, marginTop: space[2] },
  amount: { fontSize: font.input, color: colors.text, fontVariant: ['tabular-nums'] },
  chevron: { fontSize: font.title, color: colors.faint },
});
