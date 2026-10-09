import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/theme';
import PlusButton from './PlusButton';

type Props = {
  label: string;
  selected?: boolean;
  /** greyed text, e.g. a deleted category */
  muted?: boolean;
  /** dashed outline in the accent color: "Сбросить все" */
  action?: boolean;
  /** creates something ("Новая категория", "Новый раздел"): a white "+" on the accent, the label only for TalkBack */
  add?: boolean;
  /** without onPress the chip is display-only */
  onPress?: () => void;
  disabled?: boolean;
  /** compact: the active filters' chips */
  small?: boolean;
  /** tighter, for long lists of options (the category picker); no width cap, unlike `small` */
  compact?: boolean;
  /** a mark after the label that is never cut off with it ("✕" on a removable filter) */
  trailing?: string;
};

/** Rounded pill used for categories, types and filter options. */
export default function Chip({ label, selected, muted, action, add, onPress, disabled, small, compact, trailing }: Props) {
  if (add) return <PlusButton onPress={onPress ?? (() => {})} accessibilityLabel={label} disabled={disabled} size={compact ? 32 : 38} />;
  return (
    <TouchableOpacity
      style={[styles.chip, small && styles.chipSmall, compact && styles.chipCompact, trailing !== undefined && styles.row, selected && styles.selected, action && styles.action]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityState={{ selected: !!selected }}
    >
      <Text numberOfLines={1} style={[styles.text, small && styles.textSmall, compact && styles.textCompact, trailing !== undefined && styles.shrink, selected && styles.textSelected, muted && !selected && styles.textMuted, action && styles.textAction]}>
        {label}
      </Text>
      {trailing !== undefined ? (
        <Text style={[styles.text, small && styles.textSmall, styles.trailing, selected && styles.textSelected]}>{trailing}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface,
  },
  // a long name is cut with "…" so several fit on a line
  chipSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, maxWidth: '48%' },
  row: { flexDirection: 'row', alignItems: 'center' },
  trailing: { marginLeft: 6, flexShrink: 0 },
  shrink: { flexShrink: 1 },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  action: { backgroundColor: colors.bg, borderColor: colors.border, borderStyle: 'dashed' },
  text: { fontSize: 15, color: colors.text },
  textSmall: { fontSize: 13 },
  chipCompact: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  textCompact: { fontSize: 14 },
  textSelected: { color: '#FFFFFF' },
  textMuted: { color: colors.muted },
  textAction: { color: colors.accent },
});
