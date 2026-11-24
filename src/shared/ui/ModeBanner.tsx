import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, radius, space, weight } from '../theme/tokens';

type Props = {
  /** what is going on: sorting out a category being deleted, picking an operation for a payment */
  text: string;
  onCancel: () => void;
  /** the banner is `<id>-banner`, its "Отменить" `<id>-cancel` */
  testID?: string;
};

/** A mode a list is in, over its filters, and "Отменить" to leave it. */
export default function ModeBanner({ text, onCancel, testID }: Props) {
  return (
    <View style={styles.banner} testID={testID ? `${testID}-banner` : undefined}>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity
        onPress={onCancel}
        hitSlop={8}
        accessibilityRole="button"
        testID={testID ? `${testID}-cancel` : undefined}
      >
        <Text style={styles.cancel}>Отменить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    marginBottom: space[8],
    paddingHorizontal: space[12],
    paddingVertical: space[10],
    borderRadius: radius.md,
    backgroundColor: colors.warnBg,
  },
  text: { flex: 1, fontSize: font.secondary, fontWeight: weight.semibold, color: colors.warn },
  cancel: { fontSize: font.secondary, color: colors.danger },
});
