import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MerchantLink } from '@/entities/merchant';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import { font, space } from '@/shared/theme/tokens';

export type SubRowNote = { prefix?: string; text: string; warn?: boolean };

type Props = {
  name: string;
  merchantKey: string | null;
  /** show name as a MerchantLink (screens with no row tap); false — plain text */
  linked?: boolean;
  gone?: boolean;
  note: SubRowNote | null;
  amount: string;
  /** bracketed secondary "(7.79 ₾)" when the primary is in another currency */
  amountInShown?: string;
  /** below the amount: "в месяц · X ₾ в год" */
  amountNote?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** A subscription row in the «SubsTrend» visual style: left — name + note, right — amount + per-month/year. */
export default function SubRow({
  name,
  merchantKey,
  linked,
  gone,
  note,
  amount,
  amountInShown,
  amountNote,
  onPress,
  accessibilityLabel,
}: Props) {
  const inner = (
    <View style={[styles.row, gone && styles.gone]}>
      <View style={styles.left}>
        {merchantKey && linked && !gone ? (
          <MerchantLink merchantKey={merchantKey} label={name} />
        ) : (
          <Text style={styles.name}>{name}</Text>
        )}
        {note ? (
          <Text style={styles.note}>
            {note.prefix ? note.prefix + ' · ' : ''}
            <Text style={note.warn ? styles.warn : undefined}>{note.text}</Text>
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Masked style={styles.name}>
          {amount}
          {amountInShown ? <Text style={styles.muted}>{amountInShown}</Text> : null}
        </Masked>
        {!gone && amountNote ? <Text style={styles.note}>{amountNote}</Text> : null}
      </View>
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {inner}
    </TouchableOpacity>
  ) : (
    inner
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: space[10] },
  gone: { opacity: 0.6 },
  left: { flex: 1, marginRight: space[12] },
  right: { alignItems: 'flex-end' },
  name: { fontSize: font.input, color: colors.text, marginTop: space[4] },
  note: { fontSize: font.meta, color: colors.muted, marginTop: space[2] },
  muted: { color: colors.muted },
  warn: { color: colors.warn },
});
