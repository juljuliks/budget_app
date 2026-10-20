import React from 'react';
import { StyleProp, StyleSheet, Switch, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  label: string;
  /** what it does when off, where / how when on */
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
  /** when on: a link under the hint ("Сменить папку") */
  change?: { title: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

/** A setting with its switch ("Автокопия", "Регулярные платежи"): its state in a line, a link to change it while on. */
export default function SwitchRow({ label, hint, on, onChange, change, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
        {on && change ? (
          <TouchableOpacity onPress={change.onPress} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{change.title}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Switch
        value={on}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 16, color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
  link: { fontSize: 14, color: colors.accent, marginTop: 6 },
});
