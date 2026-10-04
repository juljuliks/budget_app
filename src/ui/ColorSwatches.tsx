import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from './theme';

type Props = {
  options: string[];
  /** null = "Авто" */
  value: string | null;
  onChange: (color: string | null) => void;
  /** the color "Авто" resolves to, shown inside its swatch */
  autoColor?: string;
  /** "Авто" does this instead of choosing null (e.g. generates a color) */
  onAuto?: () => void;
};

/** Row of color circles plus "Авто"; the selected one gets a ring. */
export default function ColorSwatches({ options, value, onChange, autoColor, onAuto }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.auto, value === null && styles.selected]}
        onPress={() => (onAuto ? onAuto() : onChange(null))}
        accessibilityLabel="Цвет автоматически"
        accessibilityState={{ selected: value === null }}
      >
        {autoColor ? <View style={[styles.autoDot, { backgroundColor: autoColor }]} /> : null}
        <Text style={styles.autoText}>Авто</Text>
      </TouchableOpacity>
      {options.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.ring, value === c && styles.selected]}
          onPress={() => onChange(c)}
          accessibilityLabel={`Цвет ${c}`}
          accessibilityState={{ selected: value === c }}
        >
          <View style={[styles.swatch, { backgroundColor: c }]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Small strip of a palette's shades (types screen). */
export function PaletteStrip({ shades, size = 14 }: { shades: string[]; size?: number }) {
  return (
    <View style={styles.strip}>
      {shades.map((c) => <View key={c} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  ring: { padding: 3, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: colors.accent },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  auto: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 38,
    borderRadius: 19, borderWidth: 2, borderColor: colors.border,
  },
  autoDot: { width: 16, height: 16, borderRadius: 8 },
  autoText: { fontSize: 14, color: colors.text },
  strip: { flexDirection: 'row', gap: 3 },
});
