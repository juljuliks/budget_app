import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formStyles } from '../theme/formStyles';
import { colors } from '../theme/theme';
import { font, space, weight } from '../theme/tokens';

type Props = {
  title: string;
  /** "41.55 ₾"; none — the title alone */
  total?: string | null;
  /** its share of the budget, "1%" */
  share?: string | null;
  /** the sheet's side padding: the band goes edge to edge */
  inset?: number;
  /** an action at its right edge ("Показать все ›") */
  right?: React.ReactNode;
};

/** A section's grey band, as the plan's: its title, its total and share of the budget ("41.55 ₾ · 1%") or an action. */
export default function SectionBand({ title, total, share, inset = 20, right }: Props) {
  return (
    <View style={[formStyles.sectionHeader, styles.band, { marginHorizontal: -inset, paddingHorizontal: inset }]}>
      <Text style={styles.title}>{title}</Text>
      {total ? (
        <Text style={styles.total}>
          {total}
          {share ? <Text style={styles.share}>{` · ${share}`}</Text> : null}
        </Text>
      ) : null}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[16],
    marginBottom: space[4],
  },
  title: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.muted },
  total: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  share: { color: colors.muted, fontWeight: weight.regular },
});
