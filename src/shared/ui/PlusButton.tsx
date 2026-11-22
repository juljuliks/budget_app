import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/theme';
import Button from './Button';

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

/** The drawn plus, `size` points across: white, or `color`. */
function Plus({ size, stroke, color = '#FFFFFF' }: { size: number; stroke: number; color?: string }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Path d={`M${c} 0 V${size} M0 ${c} H${size}`} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The other "create" button: "+ Создать" — a small primary `Button` with the drawn plus, where a word fits better than
 * a bare plus (a screen header). The circle above is the app's only button of its own; everything else is `Button`.
 */
export function CreateButton({ onPress, accessibilityLabel, title = 'Создать', style }: {
  onPress: () => void; accessibilityLabel: string; title?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Button
      title={title} onPress={onPress} size="small" accessibilityLabel={accessibilityLabel} style={style}
      icon={(c) => <Plus size={12} stroke={2.2} color={c} />}
    />
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
