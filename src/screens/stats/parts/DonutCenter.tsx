import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import Masked from '@/shared/ui/Masked';
import { formatWithCurrency } from '@/shared/lib/money';
import { formatPercent } from '@/shared/lib/format';
import { colors } from '@/shared/theme/theme';
import { PencilIcon } from '@/shared/ui/icons';

/** the hole's width the amount may take: the ring's inner diameter (220 − 2 × 22) minus some air */
const HOLE_TEXT_WIDTH = 150;
/** a bold digit is about this share of the font size wide */
const CHAR_WIDTH = 0.6;

/** The amount's font size so it fits the hole's width: `max` for a short one, smaller as it gets longer. */
export function fitSize(text: string, max: number, width = HOLE_TEXT_WIDTH): number {
  return Math.min(max, Math.floor(width / (text.length * CHAR_WIDTH)));
}

type Props = {
  total: number; picked?: { name: string; emoji: string | null; spent_minor: number }; currency: Currency;
  /** the month's stats with a plan: "из 3 666 ₾ · 96% ✏️" under the total (a tap in the hole — its budget) */
  of?: number;
  /** the month's ring beside its legend: its hole's width for the text — smaller type, "из …" and its % may wrap */
  hole?: number;
};

/** The hole: the total spent, or the tapped category's spending and its share of the total. */
export default function DonutCenter({ total, picked, currency, of, hole }: Props) {
  const small = hole !== undefined;
  const w = hole;
  const cap = [styles.caption, small && styles.captionSmall];
  if (!picked) {
    return (
      <>
        <Text style={cap}>Потрачено</Text>
        {/* the currency on the amount's line, as for a tapped segment */}
        <Masked style={[styles.hero, { fontSize: fitSize(formatWithCurrency(total, currency), small ? 28 : 34, w) }]}>{formatWithCurrency(total, currency)}</Masked>
        {of ? (
          <View style={[styles.ofRow, small && styles.ofRowSmall, small && { maxWidth: hole }]}>
            <Masked style={cap}>{`из ${formatWithCurrency(Math.round(of), currency)}`}</Masked>
            {/* the share stays when the amounts are hidden; past the plan — orange */}
            {total > 0 ? <Text style={[cap, total > Math.round(of) && styles.over]}>{`· ${formatPercent(total, of)}`}</Text> : null}
            <PencilIcon color={colors.accent} size={14} />
          </View>
        ) : null}
      </>
    );
  }
  const share = total > 0 ? Math.round((picked.spent_minor / total) * 100) : 0;
  return (
    <>
      <Text style={[styles.pickedName, small && styles.pickedNameSmall, small && { maxWidth: hole }]} numberOfLines={2}>{`${picked.emoji || ''} ${picked.name}`.trim()}</Text>
      <Masked style={[styles.pickedAmount, { fontSize: fitSize(formatWithCurrency(picked.spent_minor, currency), small ? 20 : 24, w) }]}>{formatWithCurrency(picked.spent_minor, currency)}</Masked>
      <Text style={cap}>{share === 0 && picked.spent_minor > 0 ? '<1' : share}% всех трат</Text>
    </>
  );
}

/** the hole's look: the month's «План» view writes in it too */
export const centerStyles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.muted },
  over: { color: colors.warn, fontWeight: '600' },
  ofRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  hero: { fontSize: 34, fontWeight: '700', color: colors.text },
  pickedName: { fontSize: 15, color: colors.text, textAlign: 'center', maxWidth: 150 },
  // the small ring
  captionSmall: { fontSize: 12 },
  ofRowSmall: { flexWrap: 'wrap', justifyContent: 'center', columnGap: 3, rowGap: 0 },
  pickedNameSmall: { fontSize: 13 },
  pickedAmount: { fontSize: 24, fontWeight: '700', color: colors.text, marginVertical: 2 },
});
const styles = centerStyles;
