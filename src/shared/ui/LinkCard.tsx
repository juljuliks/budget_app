import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';
import { ChevronRightIcon } from './icons';

/**
 * A grey card opening a page: an icon, its name, an arrow (a category's «Динамика трат»). The look of the stats' line
 * that opens a month's report.
 */
export default function LinkCard({ icon, label, onPress, style }: {
  icon: React.ReactNode; label: string; onPress: () => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} accessibilityRole="button">
      {icon}
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <ChevronRightIcon color={colors.accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48,
    paddingLeft: 14, paddingRight: 12, borderRadius: 12, backgroundColor: colors.surface,
  },
  label: { flex: 1, fontSize: 16, color: colors.text },
});
