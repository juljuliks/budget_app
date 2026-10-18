import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';

type Props = {
  name: string;
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

/** A subscription in the "Подписки" sheet: name and what it is, the amount; a tap opens it. */
export default function SubscriptionRow({ name, note, tone, amount, amountNote, muted, ring, onPress }: Props) {
  const last = note[note.length - 1];
  const head = note.slice(0, -1);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Подписка: ${name}`}>
      {ring !== undefined ? <ProgressRing ratio={ring} color={ring >= 1 ? colors.income : colors.fund} track={colors.fundTrack} size={22} /> : null}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  ok: { color: colors.income },
  warn: { color: colors.warn, fontWeight: '500' },
  amountBox: { alignItems: 'flex-end' },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  muted: { color: colors.muted },
  amountNote: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
