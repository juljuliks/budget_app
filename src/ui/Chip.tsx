import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from './theme';

type Props = {
  label: string;
  selected?: boolean;
  /** greyed text, e.g. a deleted category */
  muted?: boolean;
  /** dashed outline in the accent color: "＋ Новая категория" */
  action?: boolean;
  /** without onPress the chip is display-only */
  onPress?: () => void;
  disabled?: boolean;
};

/** Rounded pill used for categories, types and filter options. */
export default function Chip({ label, selected, muted, action, onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.selected, action && styles.action]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityState={{ selected: !!selected }}
    >
      <Text style={[styles.text, selected && styles.textSelected, muted && !selected && styles.textMuted, action && styles.textAction]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  action: { backgroundColor: colors.bg, borderColor: colors.border, borderStyle: 'dashed' },
  text: { fontSize: 15, color: colors.text },
  textSelected: { color: '#FFFFFF' },
  textMuted: { color: colors.muted },
  textAction: { color: colors.accent },
});
