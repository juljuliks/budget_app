import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from './theme';

type Props = {
  onPress: () => void;
  /** what it creates, for TalkBack ("Новая категория", "Свой цвет") */
  accessibilityLabel: string;
  /** the circle's diameter: 34–38 next to chips and swatches, 56 for the floating one */
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Every "create / add" button of the app: a white plus on an accent circle, only the size differs. The plus is
 * drawn (not a "+" character) so it sits exactly in the middle at any size.
 */
export default function PlusButton({ onPress, accessibilityLabel, size = 38, disabled, style }: Props) {
  const arm = size * 0.42;
  return (
    <TouchableOpacity
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Plus size={arm} stroke={Math.max(2, size / 16)} />
    </TouchableOpacity>
  );
}

/** The drawn plus, white, `size` points across. */
function Plus({ size, stroke }: { size: number; stroke: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Path d={`M${c} 0 V${size} M0 ${c} H${size}`} stroke="#FFFFFF" strokeWidth={stroke} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The other "create" button: "+ Создать" on an accent pill, where a word fits better than a bare plus (a screen
 * header). The app has just these two: PlusButton and CreateButton.
 */
export function CreateButton({ onPress, accessibilityLabel, title = 'Создать', style }: {
  onPress: () => void; accessibilityLabel: string; title?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity style={[styles.pill, style]} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Plus size={12} stroke={2.2} />
      <Text style={styles.pillText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17,
    backgroundColor: colors.accent,
  },
  pillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
