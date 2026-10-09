import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Bucket } from '@/db/categoryDeletion';
import { colors } from '@/shared/theme/theme';
import { sortOutBanner } from '../texts';

/** What is left of the category being deleted, and "Отменить". */
export default function SortOutBanner({ label, remaining, onCancel }: { label: string; remaining: Bucket | null; onCancel: () => void }) {
  return (
    <View style={styles.banner} testID="sort-out-banner">
      <Text style={styles.text}>{remaining ? sortOutBanner(label, remaining) : `Удаление «${label}»`}</Text>
      <TouchableOpacity onPress={onCancel} hitSlop={8} accessibilityRole="button" testID="sort-out-cancel">
        <Text style={styles.cancel}>Отменить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: colors.warnBg,
  },
  text: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.warn },
  cancel: { fontSize: 14, color: colors.danger },
});
