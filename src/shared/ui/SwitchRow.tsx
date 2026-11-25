import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';
import { font, space } from '../theme/tokens';
import Toggle from './Toggle';

type Props = {
  label: string;
  /** what it does when off, where / how when on */
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
  /** when on: a link under the hint ("Сменить папку") */
  change?: { title: string; onPress: () => void };
  /** can't be turned now (the hint says why): pale, the switch doesn't move */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A setting with its switch ("Автокопия", "Регулярные платежи"): its state in a line, a link to change it while on. */
export default function SwitchRow({ label, hint, on, onChange, change, disabled, style }: Props) {
  return (
    <View style={[styles.row, disabled && styles.disabled, style]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
        {on && change ? (
          <TouchableOpacity onPress={change.onPress} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{change.title}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Toggle label={label} value={on} onChange={onChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[20],
    paddingVertical: space[14],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: space[2] },
  label: { fontSize: font.input, color: colors.text },
  hint: { fontSize: font.meta, color: colors.muted },
  link: { fontSize: font.secondary, color: colors.accent, marginTop: space[6] },
  disabled: { opacity: 0.5 },
});
