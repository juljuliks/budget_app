// The month stats' look, one for all its parts.
import { StyleSheet } from 'react-native';
import { chart, colors } from '@/shared/theme/theme';
import { font, layout, radius, space, weight } from '@/shared/theme/tokens';

export const styles = StyleSheet.create({
  report: { marginTop: space[4] },
  screen: { flex: 1, backgroundColor: colors.bg },
  // room under the last row for «＋»
  content: { paddingHorizontal: space[16], paddingBottom: layout.fabClearance },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: space[16] },
  // over the ring «Траты» / «План»; the ring at the left, half the block; at its right the cut — «Категории» /
  // «Разделы» as words with an underline, not a second segmented — and the legend
  donutRow: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch', gap: space[16] },
  donutSide: { flex: 1, minWidth: 0 },
  donutCuts: { marginBottom: space[10] },
  cutTabs: {
    flexDirection: 'row',
    gap: space[16],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cutTab: {
    paddingBottom: space[6],
    marginBottom: -StyleSheet.hairlineWidth,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  cutTabOn: { borderColor: colors.accent },
  cutTabText: { fontSize: font.secondary, color: colors.muted },
  cutTabTextOn: { color: colors.accent, fontWeight: weight.semibold },
  donutNames: { gap: space[6] },
  donutName: { flexDirection: 'row', alignItems: 'center' },
  donutNameText: { flexShrink: 1, fontSize: font.meta, color: colors.text },
  donutNameShare: {
    marginLeft: 'auto',
    paddingLeft: space[6],
    fontSize: font.meta,
    fontWeight: weight.bold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  donutRest: { color: colors.muted },
  donutRestRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[8], marginLeft: space[14] },
  donutMore: { fontSize: font.meta },
  donutMoreAt: { marginLeft: 'auto' },
  // «Распределение бюджета»: the budget with its pencil, «Свободно» at the bottom
  splitBody: { paddingHorizontal: space[20], flexShrink: 1 },
  splitCuts: { marginBottom: space[8] },
  splitBudget: { flexDirection: 'row', alignItems: 'center', gap: space[4], marginBottom: space[12] },
  splitFree: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space[12],
  },
  legendDim: { opacity: 0.4 },
  legendDot: { width: 8, height: 8, borderRadius: radius.xs, marginRight: space[6] },
  monthBox: { marginBottom: 0 },
  longPressHint: { fontSize: font.caption, color: colors.muted, marginTop: space[8], marginBottom: -space[10] },
  dangerText: { color: colors.danger },
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
  // «· 35%» after a section's title: its share of the budget, bold
  groupShare: { fontWeight: weight.bold },
  groupTotal: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  row: { paddingVertical: space[8], borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  // a category's row: the name over its amounts, what is left at the right on the same two lines
  rowCols: { flexDirection: 'row', alignItems: 'flex-start' },
  rowMain: { flex: 1, minWidth: 0 },
  rowSub: { fontSize: font.meta, color: colors.muted, marginTop: space[2], marginLeft: space[20] },
  rowSubLine: { flexDirection: 'row', alignItems: 'center', marginTop: space[2], marginLeft: space[20] },
  rowSubText: { flexShrink: 1, fontSize: font.meta, color: colors.muted },
  dot: { width: 10, height: 10, borderRadius: radius.xs, marginRight: space[8] },
  rowName: { flexShrink: 1, fontSize: font.body, color: colors.text },
  addToPlan: {
    marginLeft: space[8],
    paddingHorizontal: space[8],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addToPlanText: { fontSize: font.caption, color: colors.accent },
  // a planned row's right: what is left, big, and what it is under it
  rowLeft: { marginLeft: 'auto', paddingLeft: space[8], alignItems: 'flex-end' },
  leftBig: { fontSize: font.body, fontWeight: weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  leftCaption: { fontSize: font.caption, color: colors.muted },
  // a payment charged several times a month: a piece per charge
  payments: { flexDirection: 'row', gap: space[4], marginTop: space[6] },
  paymentPiece: { flex: 1, height: 6, borderRadius: radius.xs, backgroundColor: chart.meterTrack },
  rowAmount: {
    marginLeft: 'auto',
    paddingLeft: space[8],
    fontSize: font.meta,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  rowLimit: { color: colors.muted },
  rowStatus: { fontSize: font.meta, color: colors.muted, marginTop: space[4] },
  rowStatusMuted: { color: colors.muted },
  paceLine: { fontWeight: weight.semibold },
  // an overspend, the same on every screen: bold orange, no ⚠
  sectionBand: {
    marginHorizontal: -space[16],
    paddingHorizontal: space[16],
    paddingTop: space[2],
    paddingBottom: space[10],
    backgroundColor: colors.surface,
  },
  overLine: { color: colors.warn, fontWeight: weight.semibold },
  overNum: { color: colors.warn },
  paceOk: { color: colors.income },
  // «Сбережения»: under its band, what the amounts mean; ⓘ after an amount; "Подвести итоги ›"
  savingsCaption: { fontSize: font.caption, color: colors.muted, marginTop: space[8] },
  infoGap: { marginLeft: space[4] },
  closeLink: { fontSize: font.secondary, color: colors.accent, marginTop: space[10] },
  // a month without a plan: the hint, «Бюджет месяца ›»
  noPlan: { alignItems: 'center', marginBottom: space[12] },
  planLink: { fontSize: font.secondary, color: colors.accent },
  // under the month's bar: what the month before sent
  carryLine: { fontSize: font.meta, marginTop: space[6] },
  paceAhead: { color: colors.warn },
  refundsAmount: { fontSize: font.body, color: colors.income, fontVariant: ['tabular-nums'] },
  // under the amount, on the right
  paidOn: { color: colors.income },
});

/** "spent" and its "(%)" in a "spent / limit (%)" turn orange once over the limit (the limit itself stays muted) */
export const overStyle = (spent: number, limit: number) =>
  limit > 0 && spent > Math.round(limit) ? styles.overNum : undefined;
