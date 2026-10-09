import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from './theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** red, for deleting */
  danger?: boolean;
  /** outlined instead of filled: the less usual choice next to a filled one ("Для мерчанта", "Открепить категорию") */
  outline?: boolean;
  style?: StyleProp<ViewStyle>;
  /** for the end-to-end flows (tests/e2e) */
  testID?: string;
};

/** Full-width button ("Сохранить", "Удалить операцию", ...): filled, or outlined; accent or red. */
export default function Button({ title, onPress, disabled, danger, outline, style, testID }: Props) {
  const color = danger ? colors.danger : colors.accent;
  return (
    <TouchableOpacity
      style={[styles.button, outline ? [styles.outline, { borderColor: color }] : { backgroundColor: color }, disabled && styles.disabled, style]}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
    >
      <Text style={[styles.text, outline && { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

type SheetActionsProps = {
  /** the main action, full width; null = only "Отмена" (e.g. nothing changed yet) */
  submit: { title: string; onPress: () => void; disabled?: boolean; danger?: boolean } | null;
  /** more actions under it, outlined */
  extra?: Array<{ title: string; onPress: () => void; danger?: boolean }>;
  onCancel?: () => void;
  cancelTitle?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The buttons of every sheet, one look across the app: the main action filled and full width, other choices
 * outlined under it, "Отмена" at the bottom outlined in grey.
 */
export function SheetActions({ submit, extra, onCancel, cancelTitle = 'Отмена', style }: SheetActionsProps) {
  return (
    <View style={[styles.actions, style]}>
      {submit ? <Button title={submit.title} onPress={submit.onPress} disabled={submit.disabled} danger={submit.danger} /> : null}
      {extra?.map((b) => <Button key={b.title} title={b.title} onPress={b.onPress} danger={b.danger} outline />)}
      {onCancel ? (
        <TouchableOpacity style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancelText}>{cancelTitle}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  // the border takes a point of the padding: the same height as a filled one
  outline: { borderWidth: 1, paddingVertical: 13 },
  disabled: { opacity: 0.5 },
  text: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  actions: { gap: 10, marginTop: 16 },
  // as tall as the other buttons, a grey border
  cancel: { alignItems: 'center', paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  cancelText: { fontSize: 16, color: colors.muted },
});
