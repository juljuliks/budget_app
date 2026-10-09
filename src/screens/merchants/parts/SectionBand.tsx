import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { plural } from '@/shared/lib/format';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import type { Section } from '../model/useMerchants';

/** A grey band, like the days on the operations: "🛒 Еда · 5 мерчантов"; the stale one folds and unfolds. */
export default function SectionBand({ section, staleOpen, onToggleStale }: { section: Section; staleOpen: boolean; onToggleStale: () => void }) {
  const title = `${section.title} · ${section.count} ${plural(section.count, ['мерчант', 'мерчанта', 'мерчантов'])}`;
  if (!section.stale) return <Text style={formStyles.sectionHeader}>{title}</Text>;
  return (
    <TouchableOpacity
      style={[formStyles.sectionHeader, styles.staleHeader]}
      onPress={onToggleStale}
      accessibilityRole="button"
      accessibilityState={{ expanded: staleOpen }}
    >
      <Text style={styles.staleTitle}>{title}</Text>
      <Text style={styles.staleToggle}>{staleOpen ? 'Свернуть' : 'Показать'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  staleHeader: { flexDirection: 'row', alignItems: 'center' },
  staleTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
  staleToggle: { fontSize: 13, color: colors.accent },
});
