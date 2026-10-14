import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { MONTHS_NOM } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';

type Money = { minor: number; currency: Currency };

/** "сентябрь", "сентябрь 2025" ('YYYY-MM'): the year only when it isn't this one. */
function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_NOM[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
}

/** Over a plan amount's field, what helps to pick it: the room in the budget, the last plan, the usual spending. */
export default function PlanFacts({ free, previous, average, shown }: {
  free: Money | null;
  previous: (Money & { ym: string }) | null;
  average: { minor: number; months: number } | null;
  /** the app's currency: the average is in it */
  shown: Currency;
}) {
  const facts: Array<{ label: string; value: string }> = [];
  // the month's budget minus the other categories' plans: not about what is spent
  if (free) facts.push({ label: 'Можно запланировать', value: `до ${formatWithCurrency(free.minor, free.currency)}` });
  if (previous) facts.push({ label: `В плане на ${monthName(previous.ym)}`, value: formatWithCurrency(previous.minor, previous.currency) });
  if (average) {
    facts.push({
      label: `В среднем в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`,
      value: `≈ ${formatWithCurrency(average.minor, shown)}`,
    });
  }
  if (!facts.length) return null;
  return (
    <View style={styles.facts}>
      {facts.map((f) => (
        <View key={f.label} style={styles.fact}>
          <Text style={styles.label}>{f.label}</Text>
          <Text style={styles.value}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { marginBottom: 12, gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  label: { flex: 1, fontSize: 14, color: colors.muted },
  value: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
