import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import { colors } from '../theme/theme';

type Props = {
  /** what is chosen ("☕️ Жизнь: Кафе и рестораны", "⚪️ Без категории") */
  value: string;
  /** opens the choice (a sheet) */
  onPress: () => void;
  /** TalkBack: what a tap does ("Сменить категорию") */
  accessibilityLabel: string;
  disabled?: boolean;
  /** a square "›" at the right: the chosen one's page ("Открыть категорию") */
  open?: { onPress: () => void; accessibilityLabel: string };
  style?: StyleProp<ViewStyle>;
  /** the field's; the "›" gets `${testID}-open` */
  testID?: string;
};

/**
 * A choice made in a sheet, one look across the app: the chosen value in a field with "⌄" (a tap — the sheet);
 * with `open`, a square "›" beside it goes to the chosen one's page.
 */
export default function SelectField({ value, onPress, accessibilityLabel, disabled, open, style, testID }: Props) {
  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity style={styles.field} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}>
        <Text style={styles.value} numberOfLines={2}>{value}</Text>
        <ChevronDownIcon color={colors.muted} size={18} />
      </TouchableOpacity>
      {open ? (
        <TouchableOpacity
          style={styles.open} onPress={open.onPress} accessibilityRole="button" accessibilityLabel={open.accessibilityLabel}
          testID={testID ? `${testID}-open` : undefined}
        >
          <ChevronRightIcon color={colors.accent} size={20} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  field: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.surface,
  },
  value: { flex: 1, fontSize: 17, color: colors.text },
  open: { width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border },
});
