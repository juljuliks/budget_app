import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from './theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** red, for deleting */
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Full-width filled button ("Сохранить", "Удалить транзакцию", ...). */
export default function Button({ title, onPress, disabled, danger, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, danger && styles.danger, disabled && styles.disabled, style]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  text: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
