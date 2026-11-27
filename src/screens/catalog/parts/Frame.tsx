import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, space, weight } from '@/shared/theme/tokens';

/** One component of the catalog: its name, what it is for, its variants under it. */
export default function Frame({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
  return (
    <View style={styles.frame} testID={`catalog-${name}`}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.note}>{note}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    paddingHorizontal: space[16],
    paddingVertical: space[16],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  name: { fontSize: font.title, fontWeight: weight.semibold, color: colors.text },
  note: { fontSize: font.meta, color: colors.muted, marginTop: space[2] },
  body: { marginTop: space[12], gap: space[10] },
});
