import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { sheetAlert } from '@/shared/ui/sheetAlert';

/**
 * A plan amount past what is free, the rest in "🔒 Отложить сразу": "Вычесть из сбережений?" — what the savings become
 * and by how much (−N% of them); 🔒 has less — all of it, the plan over its budget. `short`, `locked` in the budget's
 * `currency`; `onYes` gets what to take.
 */
export function askTakeLocked({ short, locked, currency, adding, onYes }: {
  short: number; locked: number; currency: Currency; adding: boolean; onYes: (take: number) => void;
}) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  const take = Math.min(short, locked);
  const pct = Math.max(1, Math.round((take / locked) * 100));
  sheetAlert(
    'Вычесть из сбережений?',
    take < short
      ? `Свободного не хватает ${money(short)}, в сбережениях — ${money(locked)}. План будет больше бюджета на ${money(short - take)}.`
      : `Свободного не хватает ${money(short)} — их можно взять из сбережений.`,
    [{ text: adding ? 'Вычесть и добавить' : 'Вычесть и сохранить', onPress: () => onYes(take) }, { text: 'Отмена', style: 'cancel' }],
    undefined,
    () => (
      <View style={styles.card}>
        <Text style={styles.name}>🔒 Отложить сразу</Text>
        <Text style={styles.was}>{money(locked)}</Text>
        <Text style={styles.now}>{money(locked - take)}</Text>
        <Text style={styles.pct}>{`(−${pct}%)`}</Text>
      </View>
    ),
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'baseline', gap: 6, padding: 14, borderRadius: 12, backgroundColor: colors.savingsBg, marginBottom: 12 },
  name: { flex: 1, fontSize: 14, color: colors.text },
  was: { fontSize: 13, color: colors.muted, textDecorationLine: 'line-through' },
  now: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  pct: { fontSize: 14, color: colors.muted },
});
