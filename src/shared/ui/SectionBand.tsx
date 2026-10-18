import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formStyles } from '../theme/formStyles';
import { colors } from '../theme/theme';

type Props = {
  title: string;
  /** "41.55 ₾"; none — the title alone */
  total?: string | null;
  /** its share of the budget, "1%" */
  share?: string | null;
  /** the sheet's side padding: the band goes edge to edge */
  inset?: number;
};

/** A section's grey band, as the plan's: its title, its total and share of the budget ("41.55 ₾ · 1%"). */
export default function SectionBand({ title, total, share, inset = 20 }: Props) {
  return (
    <View style={[formStyles.sectionHeader, styles.band, { marginHorizontal: -inset, paddingHorizontal: inset }]}>
      <Text style={styles.title}>{title}</Text>
      {total ? (
        <Text style={styles.total}>
          {total}
          {share ? <Text style={styles.share}>{` · ${share}`}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  title: { fontSize: 13, fontWeight: '600', color: colors.muted },
  total: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  share: { color: colors.muted, fontWeight: '400' },
});
