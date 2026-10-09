import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';
import PlusButton from './PlusButton';

type Props = {
  options: string[];
  /** null = "Авто" */
  value: string | null;
  onChange: (color: string | null) => void;
  /** "Авто" does this instead of choosing null (e.g. generates a color) */
  onAuto?: () => void;
  /** a "+" right after the colors: a color of one's own (the color picker) */
  onCustom?: () => void;
};

/**
 * "Авто" for colors and palettes (the category editor, the type dialog): the same look in both places.
 * `selected` (no color chosen yet) turns the dashed border solid.
 */
export function AutoButton({ onPress, selected, style, accessibilityLabel }: {
  onPress: () => void; selected?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.auto, selected && styles.autoSelected, style]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={styles.autoText}>Авто</Text>
    </TouchableOpacity>
  );
}

/** Row of color circles plus "Авто"; the selected one gets a ring. */
export default function ColorSwatches({ options, value, onChange, onAuto, onCustom }: Props) {
  return (
    <View style={styles.row}>
      <AutoButton
        selected={value === null}
        onPress={() => (onAuto ? onAuto() : onChange(null))}
        accessibilityLabel="Цвет автоматически"
      />
      {options.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.ring, value === c && styles.selected]}
          onPress={() => onChange(c)}
          accessibilityLabel={`Цвет ${options.indexOf(c) + 1} из ${options.length}`}
          accessibilityState={{ selected: value === c }}
        >
          <View style={[styles.swatch, { backgroundColor: c }]} />
        </TouchableOpacity>
      ))}
      {onCustom ? <PlusButton onPress={onCustom} accessibilityLabel="Свой цвет" size={34} style={styles.plus} /> : null}
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
  // the size of a swatch with its ring
  plus: { margin: 2 },
  auto: {
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, height: 38,
    borderRadius: 10, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
  },
  autoSelected: { borderColor: colors.accent, borderStyle: 'solid' },
  autoText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  strip: { flexDirection: 'row', gap: 3 },
});
