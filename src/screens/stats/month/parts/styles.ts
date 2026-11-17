// The month stats' look, one for all its parts.
import { StyleSheet } from 'react-native';
import { chart, colors } from '@/shared/theme/theme';

export const styles = StyleSheet.create({
  report: { marginTop: 4 },
  screen: { flex: 1, backgroundColor: colors.bg },
  // room under the last row for «＋»
  content: { paddingHorizontal: 16, paddingBottom: 88 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: 16 },
  // over the ring «Траты» / «План»; the ring at the left, half the block; at its right the cut — «Категории» /
  // «Разделы» as words with an underline, not a second segmented — and the legend
  donutViews: { alignSelf: 'stretch', marginBottom: 14 },
  donutRow: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch', gap: 16 },
  donutSide: { flex: 1, minWidth: 0 },
  donutCuts: { marginBottom: 10 },
  cutTabs: { flexDirection: 'row', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cutTab: { paddingBottom: 6, marginBottom: -StyleSheet.hairlineWidth, borderBottomWidth: 2, borderColor: 'transparent' },
  cutTabOn: { borderColor: colors.accent },
  cutTabText: { fontSize: 14, color: colors.muted },
  cutTabTextOn: { color: colors.accent, fontWeight: '600' },
  donutNames: { gap: 6 },
  donutName: { flexDirection: 'row', alignItems: 'center' },
  donutNameText: { flexShrink: 1, fontSize: 13, color: colors.text },
  donutNameShare: { marginLeft: 'auto', paddingLeft: 6, fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  donutRest: { color: colors.muted },
  donutRestRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginLeft: 13 },
  donutMore: { fontSize: 13 },
  donutMoreAt: { marginLeft: 'auto' },
  // «Распределение бюджета»: the budget with its pencil, «Свободно» at the bottom
  splitBody: { paddingHorizontal: 20, flexShrink: 1 },
  splitCuts: { marginBottom: 8 },
  splitBudget: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  splitFree: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  legendDim: { opacity: 0.4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  monthBox: { marginBottom: 0 },
  longPressHint: { fontSize: 12, color: colors.muted, marginTop: 8, marginBottom: -10 },
  dangerText: { color: colors.danger },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 16 },
  // a grey band across the screen, sticking on top as the days on the operations do
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  // «· 35%» after a section's title: its share of the budget, bold
  groupShare: { fontWeight: '700' },
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
  // a planned row's right: what is left, big, and what it is under it
  rowLeft: { marginLeft: 'auto', paddingLeft: 8, alignItems: 'flex-end' },
  leftBig: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  leftCaption: { fontSize: 12, color: colors.muted },
  // a payment charged several times a month: a piece per charge
  payments: { flexDirection: 'row', gap: 3, marginTop: 8 },
  paymentPiece: { flex: 1, height: 8, borderRadius: 4, backgroundColor: chart.meterTrack },
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
  // «Сбережения»: under its band, what the amounts mean; ⓘ after an amount; "Подвести итоги ›"
  savingsCaption: { fontSize: 12, color: colors.muted, marginTop: 8 },
  infoGap: { marginLeft: 4 },
  closeLink: { fontSize: 14, color: colors.accent, marginTop: 10 },
  // a month without a plan: the hint, «Бюджет месяца ›»
  noPlan: { alignItems: 'center', marginBottom: 12 },
  planLink: { fontSize: 14, color: colors.accent },
  // under the month's bar: what the month before sent
  carryLine: { fontSize: 13, marginTop: 6 },
  paceAhead: { color: colors.warn },
  crossed: { textDecorationLine: 'line-through' },
  refundsAmount: { fontSize: 15, color: colors.income, fontVariant: ['tabular-nums'] },
  // under the amount, on the right
  paidOn: { color: colors.income },
});

/** "spent" and its "(%)" in a "spent / limit (%)" turn orange once over the limit (the limit itself stays muted) */
export const overStyle = (spent: number, limit: number) => (limit > 0 && spent > Math.round(limit) ? styles.overNum : undefined);
