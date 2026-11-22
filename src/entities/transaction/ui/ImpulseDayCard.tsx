import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MOODS } from '@/domain/moods';
import { openTransaction } from '@/shared/navigation/navigation';
import Masked from '@/shared/ui/Masked';
import { chart, colors } from '@/shared/theme/theme';
import { dayCardTitle, DayPurchase, Mark } from '../model/impulseCalendarView';
import { MARK_TEXTS } from '../model/impulseTexts';

const KIND_COLOR: Record<Mark, string> = { impulsive: colors.impulseText, intentional: chart.meterFill, unanswered: colors.muted };

function kindText(p: DayPurchase): string {
  const mood = p.mark === 'impulsive' ? MOODS.find((m) => m.id === p.mood) : undefined;
  return mood ? `${MARK_TEXTS.impulsive} · ${mood.emoji} ${mood.label}` : MARK_TEXTS[p.mark];
}

/** A tapped day of «Покупки по дням»: its purchases in the category — merchant, answer, amount; a tap opens the operation. */
export default function ImpulseDayCard({ day, purchases, money }: { day: string; purchases: DayPurchase[]; money: (minor: number) => string }) {
  const sum = purchases.reduce((s, p) => s + p.value, 0);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{dayCardTitle(day)}</Text>
        <Masked style={styles.sum}>{money(sum)}</Masked>
      </View>
      {purchases.map((p, i) => (
        <TouchableOpacity key={p.tx} style={[styles.row, i > 0 && styles.divider]} onPress={() => openTransaction(p.tx)} accessibilityRole="button">
          <View style={styles.main}>
            <Text style={styles.merchant} numberOfLines={1}>{p.merchant ?? 'Без мерчанта'}</Text>
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
  card: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  title: { fontSize: 13, color: colors.muted },
  sum: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  main: { flex: 1 },
  merchant: { fontSize: 16, color: colors.text },
  kind: { fontSize: 13, marginTop: 2 },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 18, color: colors.faint },
});
