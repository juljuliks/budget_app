// The payments' marks over the month's bar.
import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/** the glyphs inside a 13 pt mark (✓ ✕, a count): the mark's geometry, smaller than any text role */
const STATUS_GLYPH = 8;
const COUNT_GLYPH = 9;
export const markStyles = StyleSheet.create({
  row: { height: 36, marginTop: space[8] },
  mark: { position: 'absolute', bottom: 0, width: 30, alignItems: 'center' },
  // still ahead: faded
  ahead: { opacity: 0.55 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: font.body },
  // payments drawn as one: their icons side by side, each over the one before, a ring of the page between them
  stack: { height: 28 },
  stacked: { position: 'absolute', top: 0, borderWidth: 1.5, borderColor: colors.bg },
  // its stem down to the bar
  stem: { width: 1, height: 6, backgroundColor: colors.faint },
  status: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 13,
    height: 13,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missed: { backgroundColor: colors.warn },
  statusText: { fontSize: STATUS_GLYPH, lineHeight: 10, fontWeight: weight.bold, color: colors.bg },
  count: {
    position: 'absolute',
    right: -5,
    top: -4,
    minWidth: 13,
    height: 13,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: COUNT_GLYPH, lineHeight: 11, fontWeight: weight.bold, color: colors.bg },
  // the mark tapped: outlined
  picked: { borderWidth: 1.5, borderColor: colors.accent },
  // its payments under the bar, instead of «Осталось …»; their state's word coloured
  infoLine: { fontSize: font.meta, color: colors.text, marginTop: space[4] },
  infoPaid: { color: colors.income, fontWeight: weight.semibold },
  infoMissed: { color: colors.warn, fontWeight: weight.semibold },
  infoAhead: { color: colors.muted },
  // a payment whose day is past and not paid, under the bar
  missedLine: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.warn, marginTop: space[2] },
});
