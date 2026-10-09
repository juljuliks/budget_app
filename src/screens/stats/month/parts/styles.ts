// The month stats' look, one for all its parts.
import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

export const styles = StyleSheet.create({
  report: { marginTop: 4 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: 16 },
  monthBox: { marginBottom: 16 },
  monthLine: { fontSize: 13, color: colors.muted },
  dangerText: { color: colors.danger },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 16 },
  // a grey band across the screen, sticking on top as the days on the operations do
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  rowName: { flexShrink: 1, fontSize: 15, color: colors.text },
  addToPlan: {
    marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  addToPlanText: { fontSize: 12, color: colors.accent },
  rowAmount: { marginLeft: 'auto', paddingLeft: 8, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  rowLimit: { color: colors.muted },
  rowStatus: { fontSize: 13, color: colors.muted, marginTop: 4 },
  rowStatusMuted: { color: colors.muted },
  paceLine: { fontWeight: '600' },
  // an overspend, the same on every screen: bold orange, no ⚠
  sectionBand: { marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, backgroundColor: colors.surface },
  overLine: { color: colors.warn, fontWeight: '600' },
  overNum: { color: colors.warn },
  paceOk: { color: colors.income },
  paceAhead: { color: colors.warn },
  crossed: { textDecorationLine: 'line-through' },
  refundsAmount: { fontSize: 15, color: colors.income, fontVariant: ['tabular-nums'] },
  // under the amount, on the right
  paidMark: { fontSize: 16, fontWeight: '700', marginLeft: 6 },
  paidOn: { color: colors.income },
  paidOff: { color: colors.muted },
});

/** "spent" and its "(%)" in a "spent / limit (%)" turn orange once over the limit (the limit itself stays muted) */
export const overStyle = (spent: number, limit: number) => (limit > 0 && spent > Math.round(limit) ? styles.overNum : undefined);
