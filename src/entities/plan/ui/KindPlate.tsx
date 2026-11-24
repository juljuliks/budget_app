import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PlanKind } from '@/db/plans';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import { KIND_NAMES } from './sheetOptions';
import { font, radius, space } from '@/shared/theme/tokens';

/** The plan's sheet: what the item is (its category's kind) and «Изменить в категории ›» — the kind is set there. */
export default function KindPlate({ kind, onOpen }: { kind: PlanKind; onOpen: () => void }) {
  return (
    <View style={styles.plate}>
      <Text style={styles.kind}>{KIND_NAMES[kind]}</Text>
      <TextLink label="Изменить в категории" onPress={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[10],
    marginBottom: space[12],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space[14],
    paddingVertical: space[12],
  },
  kind: { fontSize: font.input, color: colors.text, flexShrink: 1 },
});
