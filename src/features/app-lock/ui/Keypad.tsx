import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BackspaceIcon, FingerprintIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { font, space } from '@/shared/theme/tokens';

type Props = {
  onDigit: (d: string) => void;
  onErase: () => void;
  /** the fingerprint key left of 0 (when the fingerprint is on) */
  onBiometric?: () => void;
  disabled?: boolean;
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/** The PIN digits, 3 × 4: the fingerprint, 0 and erase in the last row. */
export default function Keypad({ onDigit, onErase, onBiometric, disabled }: Props) {
  const digit = (d: string) => (
    <TouchableOpacity
      key={d}
      style={[styles.key, styles.digit]}
      onPress={() => onDigit(d)}
      disabled={disabled}
      accessibilityLabel={d}
    >
      <Text style={[styles.text, disabled && styles.off]}>{d}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.pad}>
      {ROWS.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map(digit)}
        </View>
      ))}
      <View style={styles.row}>
        {onBiometric ? (
          <TouchableOpacity style={styles.key} onPress={onBiometric} accessibilityLabel="Отпечаток">
            <FingerprintIcon color={colors.accent} />
          </TouchableOpacity>
        ) : (
          <View style={styles.key} />
        )}
        {digit('0')}
        <TouchableOpacity style={styles.key} onPress={onErase} disabled={disabled} accessibilityLabel="Стереть">
          <BackspaceIcon color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: space[12], paddingHorizontal: 40 },
  row: { flexDirection: 'row', gap: space[24] },
  key: { flex: 1, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  digit: { backgroundColor: colors.surface },
  text: { fontSize: font.display, color: colors.text },
  off: { opacity: 0.4 },
});
