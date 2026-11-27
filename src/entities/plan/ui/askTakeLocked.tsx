import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/**
 * A plan amount past what is free, the rest in "🔒 Отложить сразу": "Вычесть из сбережений?" — what the savings become
 * and by how much (−N% of them); 🔒 has less — all of it, the plan over its budget. `short`, `locked` in the budget's
 * `currency`; `onYes` gets what to take.
 */
export function askTakeLocked({
  short,
  locked,
  currency,
  adding,
  onYes,
}: {
  short: number;
  locked: number;
  currency: Currency;
  adding: boolean;
  onYes: (take: number) => void | Promise<void>;
}) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  const take = Math.min(short, locked);
  const pct = Math.max(1, Math.round((take / locked) * 100));
  sheetAlert(
    'Вычесть из сбережений?',
    take < short
      ? `Свободного не хватает ${money(short)}, в сбережениях — ${money(locked)}. План будет больше бюджета на ${money(short - take)}.`
      : `Свободного не хватает ${money(short)} — их можно взять из сбережений.`,
    [
      { text: adding ? 'Вычесть и добавить' : 'Вычесть и сохранить', onPress: () => onYes(take) },
      { text: 'Отмена', style: 'cancel' },
    ],
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
  card: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[6],
    padding: space[14],
    borderRadius: radius.lg,
    backgroundColor: colors.savingsBg,
    marginBottom: space[12],
  },
  name: { flex: 1, fontSize: font.secondary, color: colors.text },
  was: { fontSize: font.meta, color: colors.muted, textDecorationLine: 'line-through' },
  now: { fontSize: font.secondary, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  pct: { fontSize: font.secondary, color: colors.muted },
});
