// The period stats' look, one for all its parts.
import { Platform, StyleSheet } from 'react-native';
import type { Pace } from '@/stats/norms';
import { chart, colors } from '@/shared/theme/theme';

/** One look for every ⓘ on this screen. */
export const INFO_SIZE = 18;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: 8 },
  calcTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', marginTop: 4, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  summary: { flexShrink: 1, fontSize: 14, color: colors.text, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 16 },
  // a grey band across the screen, sticking on top as the days on the operations do
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  groupPlan: { color: colors.muted },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  name: { flex: 1, fontSize: 15, color: colors.text },
  pace: { fontWeight: '600' },
  paceOk: { color: colors.income },
  paceAhead: { color: colors.warn },
  paceOver: { color: colors.danger },
  // the section's total under its title, on the same grey band: apart from the category rows below
  limitSummary: { gap: 2, marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, backgroundColor: colors.surface },
  stackWrap: { marginTop: 6, marginBottom: 4 },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 },
  stackRest: { backgroundColor: chart.meterTrack },
  stackTick: { position: 'absolute', top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.text },
  paceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  paceText: { flexShrink: 1 },
  share: { fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
  // the amount never wraps ("0 /" with the limit cut off): the name gives way
  // no tabular-nums here: Android under-measures such text and cut "0 / 106.81 ₾" to "0 /"
  amount: { flexShrink: 0, marginLeft: 8, fontSize: 13, color: colors.text },
  amountBox: { flexShrink: 0, flexDirection: 'row', alignItems: 'baseline', marginLeft: 8 },
  // a bit of room after the last glyph: "₾" comes from a fallback font Android doesn't measure, and was cut off
  amountText: { fontSize: 13, color: colors.text, paddingRight: 2 },
  amountPad: { paddingRight: 2 },
  // "/ plan" like the spending before it: one amount pair
  ofLimit: { color: colors.muted },
  overNum: { color: colors.warn },
  info: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  infoText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  infoBold: { fontWeight: '600' },
  crossed: { textDecorationLine: 'line-through' },
  calcToggle: { fontSize: 15, color: colors.accent, fontWeight: '600', paddingVertical: 4 },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 13, backgroundColor: colors.surface, color: colors.text },
  infoSheet: { maxHeight: '85%' },
  infoScroll: { flexGrow: 0, flexShrink: 1 },
  infoButton: { marginTop: 12, marginHorizontal: 20 },
});

/** "spent" and its "(%)" in a "spent / limit (%)" turn orange once over the limit (the limit itself stays muted) */
export const overStyle = (spent: number, limit: number) => (limit > 0 && spent > Math.round(limit) ? styles.overNum : undefined);
export const paceStyle = (p: Pace) => (p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.paceOver);
export const paceName = (p: Pace) => (p === 'ok' ? 'зелёный' : p === 'ahead' ? 'оранжевый' : 'красный');
