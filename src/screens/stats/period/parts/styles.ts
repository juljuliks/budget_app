// The period stats' look, one for all its parts.
import { Platform, StyleSheet } from 'react-native';
import type { Pace } from '@/stats/norms';
import { chart, colors } from '@/shared/theme/theme';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/** One look for every ⓘ on this screen. */
export const INFO_SIZE = 18;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space[16], paddingTop: space[16], paddingBottom: space[32] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: space[8] },
  calcTitle: {
    fontSize: font.meta,
    fontWeight: weight.semibold,
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: space[4],
    marginBottom: space[6],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    marginBottom: space[8],
    paddingHorizontal: space[8],
  },
  summary: { flexShrink: 1, fontSize: font.secondary, color: colors.text, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: font.secondary, textAlign: 'center', marginVertical: space[12] },
  group: { marginTop: space[16] },
  // a grey band across the screen, sticking on top as the days on the operations do
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -space[16],
  },
  groupTitle: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.muted },
  groupPlan: { color: colors.muted },
  groupTotal: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  row: { paddingVertical: space[10], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.pill, marginRight: space[8] },
  name: { flex: 1, fontSize: font.body, color: colors.text },
  pace: { fontWeight: weight.semibold },
  paceOk: { color: colors.income },
  paceAhead: { color: colors.warn },
  paceOver: { color: colors.danger },
  // the section's total under its title, on the same grey band: apart from the category rows below
  limitSummary: {
    gap: space[2],
    marginHorizontal: -space[16],
    paddingHorizontal: space[16],
    paddingTop: space[2],
    paddingBottom: space[10],
    backgroundColor: colors.surface,
  },
  stackWrap: { marginTop: space[6], marginBottom: space[4] },
  stack: { flexDirection: 'row', height: 8, borderRadius: radius.xs, overflow: 'hidden', gap: space[1] },
  stackRest: { backgroundColor: chart.meterTrack },
  stackTick: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 2,
    marginLeft: -1,
    borderRadius: radius.xs,
    backgroundColor: colors.text,
  },
  paceRow: { flexDirection: 'row', alignItems: 'center', gap: space[6], alignSelf: 'flex-start' },
  paceText: { flexShrink: 1 },
  share: { fontSize: font.meta, color: colors.muted, marginTop: space[4], fontVariant: ['tabular-nums'] },
  // the amount never wraps ("0 /" with the limit cut off): the name gives way
  // no tabular-nums here: Android under-measures such text and cut "0 / 106.81 ₾" to "0 /"
  amount: { flexShrink: 0, marginLeft: space[8], fontSize: font.meta, color: colors.text },
  amountBox: { flexShrink: 0, flexDirection: 'row', alignItems: 'baseline', marginLeft: space[8] },
  // a bit of room after the last glyph: "₾" comes from a fallback font Android doesn't measure, and was cut off
  amountText: { fontSize: font.meta, color: colors.text, paddingRight: space[2] },
  amountPad: { paddingRight: space[2] },
  // "/ plan" like the spending before it: one amount pair
  ofLimit: { color: colors.muted },
  overNum: { color: colors.warn },
  info: { paddingHorizontal: space[20], gap: space[10], paddingBottom: space[4] },
  infoText: { fontSize: font.body, color: colors.text, lineHeight: 21 },
  infoBold: { fontWeight: weight.semibold },
  crossed: { textDecorationLine: 'line-through' },
  calcToggle: { fontSize: font.body, color: colors.accent, fontWeight: weight.semibold, paddingVertical: space[4] },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: font.meta,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  infoSheet: { maxHeight: '85%' },
  infoScroll: { flexGrow: 0, flexShrink: 1 },
  infoButton: { marginTop: space[12], marginHorizontal: space[20] },
});

/** "spent" and its "(%)" in a "spent / limit (%)" turn orange once over the limit (the limit itself stays muted) */
export const overStyle = (spent: number, limit: number) =>
  limit > 0 && spent > Math.round(limit) ? styles.overNum : undefined;
export const paceStyle = (p: Pace) => (p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.paceOver);
export const paceName = (p: Pace) => (p === 'ok' ? 'зелёный' : p === 'ahead' ? 'оранжевый' : 'красный');
