import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { sheetAlert } from '@/shared/ui/sheetAlert';

/**
 * A plan amount past what is free, the rest in "🔒 Отложить сразу": "Вычесть из сбережений?" — what the savings become
 * and by how much (−N% of them). `short`, `locked` in the budget's `currency`.
 */
export function askTakeLocked({ short, locked, currency, adding, onYes }: {
  short: number; locked: number; currency: Currency; adding: boolean; onYes: () => void;
}) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  const pct = Math.max(1, Math.round((short / locked) * 100));
  sheetAlert(
    'Вычесть из сбережений?',
    `Свободного не хватает ${money(short)} — их можно взять из сбережений.`,
    [{ text: adding ? 'Вычесть и добавить' : 'Вычесть и сохранить', onPress: onYes }, { text: 'Отмена', style: 'cancel' }],
    undefined,
    () => (
      <View style={styles.card}>
        <Text style={styles.name}>🔒 Отложить сразу</Text>
        <Text style={styles.was}>{money(locked)}</Text>
        <Text style={styles.now}>{money(locked - short)}</Text>
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
