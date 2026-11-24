import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';
import { font, space, weight } from '@/shared/theme/tokens';

type Props = {
  name: string;
  /** what it is, for a screen reader ("Подписка: Netflix") */
  label: string;
  /** under the name, its parts joined with " · "; `warn` / `ok` color the last one */
  note: string[];
  tone?: 'ok' | 'warn';
  amount: string | null;
  /** under the amount ("в июне") */
  amountNote?: string;
  /** the amount muted (not the plan's this month) */
  muted?: boolean;
  /** saved up for: how far along (0–1), a ring before the name */
  ring?: number;
  onPress: () => void;
};

/** A repeating payment in the "Подписки" sheet: name and what it is, the amount; a tap opens it. */
export default function PaymentRow({ name, label, note, tone, amount, amountNote, muted, ring, onPress }: Props) {
  const last = note[note.length - 1];
  const head = note.slice(0, -1);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${name}`}
    >
      {ring !== undefined ? (
        <ProgressRing ratio={ring} color={ring >= 1 ? colors.income : colors.fund} track={colors.fundTrack} size={22} />
      ) : null}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.note} numberOfLines={2}>
          {head.length ? `${head.join(' · ')} · ` : ''}
          <Text style={tone === 'ok' ? styles.ok : tone === 'warn' ? styles.warn : null}>{last}</Text>
        </Text>
      </View>
      {amount !== null ? (
        <View style={styles.amountBox}>
          <Text style={[styles.amount, muted && styles.muted]}>{amount}</Text>
          {amountNote ? <Text style={styles.amountNote}>{amountNote}</Text> : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingVertical: space[10],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: font.input, color: colors.text },
  note: { fontSize: font.meta, color: colors.muted, marginTop: space[2] },
  ok: { color: colors.income },
  warn: { color: colors.warn, fontWeight: weight.medium },
  amountBox: { alignItems: 'flex-end' },
  amount: { fontSize: font.input, color: colors.text, fontVariant: ['tabular-nums'] },
  muted: { color: colors.muted },
  amountNote: { fontSize: font.caption, color: colors.muted, marginTop: space[2] },
});
