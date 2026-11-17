import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import Masked from '@/shared/ui/Masked';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { PencilIcon } from '@/shared/ui/icons';

/** the hole's width the amount may take: the ring's inner diameter (220 − 2 × 22) minus some air */
const HOLE_TEXT_WIDTH = 150;
/** a bold digit is about this share of the font size wide */
const CHAR_WIDTH = 0.6;

/** The amount's font size so it fits the hole's width: `max` for a short one, smaller as it gets longer. */
function fitSize(text: string, max: number): number {
  return Math.min(max, Math.floor(HOLE_TEXT_WIDTH / (text.length * CHAR_WIDTH)));
}

type Props = {
  total: number; picked?: { name: string; emoji: string | null; spent_minor: number }; currency: Currency;
  /** the month's stats with a plan: "из 3 666 ₾ ✏️" under the total (a tap in the hole — its budget) */
  of?: number;
};

/** The hole: the total spent, or the tapped category's spending and its share of the total. */
export default function DonutCenter({ total, picked, currency, of }: Props) {
  if (!picked) {
    return (
      <>
        <Text style={styles.caption}>Потрачено</Text>
        {/* the currency on the amount's line, as for a tapped segment */}
        <Masked style={[styles.hero, { fontSize: fitSize(formatWithCurrency(total, currency), 34) }]}>{formatWithCurrency(total, currency)}</Masked>
        {of ? (
          <View style={styles.ofRow}>
            <Masked style={styles.caption}>{`из ${formatWithCurrency(Math.round(of), currency)}`}</Masked>
            <PencilIcon color={colors.accent} size={14} />
          </View>
        ) : null}
      </>
    );
  }
  const share = total > 0 ? Math.round((picked.spent_minor / total) * 100) : 0;
  return (
    <>
      <Text style={styles.pickedName} numberOfLines={2}>{`${picked.emoji || ''} ${picked.name}`.trim()}</Text>
      <Masked style={[styles.pickedAmount, { fontSize: fitSize(formatWithCurrency(picked.spent_minor, currency), 24) }]}>{formatWithCurrency(picked.spent_minor, currency)}</Masked>
      <Text style={styles.caption}>{share === 0 && picked.spent_minor > 0 ? '<1' : share}% всех трат</Text>
    </>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.muted },
  ofRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  hero: { fontSize: 34, fontWeight: '700', color: colors.text },
  pickedName: { fontSize: 15, color: colors.text, textAlign: 'center', maxWidth: 150 },
  pickedAmount: { fontSize: 24, fontWeight: '700', color: colors.text, marginVertical: 2 },
});
