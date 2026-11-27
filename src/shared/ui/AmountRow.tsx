import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';
import { font, space } from '../theme/tokens';

type Props = {
  /** before the name, in a column of one width: a ring, ⟳, 🔒 */
  icon?: ReactNode;
  /** the name, one line (a node: a link of its own) */
  title: ReactNode;
  /** under the name: what it is, its progress — the slice's own lines */
  notes?: ReactNode;
  /** at the right, on the name's line: the amount and what is under it */
  amount?: ReactNode;
  /** a sheet's row: the name as large as the fields */
  large?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** e.g. a row of a later month: faded */
  style?: StyleProp<ViewStyle>;
};

/**
 * A row of a list with an amount: icon · name over its notes · the amount at the right, a line under it. The layout
 * only: what the notes and the amount say (and their colors) stays with the slice (the plan, the payments).
 */
export default function AmountRow({ icon, title, notes, amount, large, onPress, accessibilityLabel, style }: Props) {
  const body = (
    <>
      {icon !== undefined ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.body}>
        {typeof title === 'string' ? (
          <Text style={[styles.title, large && styles.large]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {notes}
      </View>
      {amount !== undefined && amount !== null ? <View style={styles.amount}>{amount}</View> : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity
      style={[styles.row, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </TouchableOpacity>
  ) : (
    <View style={[styles.row, style]} accessibilityLabel={accessibilityLabel}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[10],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  // the icons in a column of one width: the names start at one line
  icon: { width: 28, alignItems: 'center', marginRight: space[10] },
  body: { flex: 1, minWidth: 0, marginRight: space[8] },
  title: { fontSize: font.body, color: colors.text },
  large: { fontSize: font.input },
  // on the name's line, its parts at the right
  amount: { alignSelf: 'flex-start', alignItems: 'flex-end', paddingTop: space[2] },
});
