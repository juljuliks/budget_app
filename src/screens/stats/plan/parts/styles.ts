// The plan screen's look, one for all its parts.
import { StyleSheet } from 'react-native';
import { chart, colors } from '@/shared/theme/theme';
import type { Tone } from '../model/planView';
import { BAR_HEIGHT, LOCK_BADGE, RING_LOCKED } from './palette';

export const styles = StyleSheet.create({
  share: { marginTop: 4 },
  lockTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  lockMode: { marginLeft: 'auto', width: 168 },
  lockLabel: { marginBottom: 0, marginTop: 0, flexShrink: 1 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lockOwn: { fontSize: 14, color: colors.muted },
  lockInput: { flex: 1, paddingVertical: 6 },
  screen: { flex: 1 },
  // room under the last row for the "+"
  content: { paddingHorizontal: 16, paddingBottom: 88 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  budgetBox: { marginBottom: 8, padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  budgetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  // the pencil at the top, by the amount (not between it and the original one under it)
  budgetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  pencil: { marginTop: 5 },
  budgetValue: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  left: { textAlign: 'left' },
  budgetAmounts: { alignItems: 'flex-end' },
  budgetOriginal: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  barBox: { marginTop: 10 },
  bar: { flexDirection: 'row', height: BAR_HEIGHT, borderRadius: 5, overflow: 'hidden', gap: 2, backgroundColor: chart.track },
  lockBadgeBox: { position: 'absolute', top: (BAR_HEIGHT - LOCK_BADGE) / 2, height: LOCK_BADGE, alignItems: 'center', justifyContent: 'center' },
  lockBadge: {
    width: LOCK_BADGE, height: LOCK_BADGE, borderRadius: LOCK_BADGE / 2, backgroundColor: RING_LOCKED,
    borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  // the parts as a legend: a line each, the amounts and shares in columns
  parts: { gap: 6, marginTop: 10 },
  part: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // the dot in line with the name
  legendBox: { width: 16, height: 20, flexDirection: 'row', alignItems: 'center' },
  partName: { flex: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendPair: { flexDirection: 'row', alignItems: 'center' },
  // the second dot covers a third of the first, a ring of the card's colour between them
  legendOver: { width: 12, height: 12, borderRadius: 6, marginLeft: -5, borderWidth: 2, borderColor: colors.surface },
  partLabel: { fontSize: 14, lineHeight: 20, color: colors.muted },
  // the amount at the right edge, its share under it
  partValues: { alignItems: 'flex-end' },
  partValue: { textAlign: 'right', fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  // "перерасход: −15 ₾ ⓘ" under savings the overspend took part of
  less: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  lessText: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  lessMinus: { color: colors.danger },
  // a share ("43%") or a word ("сэкономлено") under the amount
  partNote: { textAlign: 'right', fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.muted, marginTop: 8 },
  overText: { color: colors.warn },
  savingsValue: { color: RING_LOCKED },
  lockedValue: { color: RING_LOCKED },
  lockedPart: { backgroundColor: RING_LOCKED, alignItems: 'center', justifyContent: 'center' },
  freeValue: { color: colors.income },
  // "Что значат значки" under the budget
  iconsLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 4 },
  iconsLinkText: { fontSize: 14, color: colors.accent },
  caption: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 12 },
  // a grey band across the screen, sticking on top as the days on the operations do
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  groupShare: { color: colors.muted, fontWeight: '400' },
  // the total in the budget's currency before it: lighter and thin
  groupForeign: { color: colors.faint, fontWeight: '400' },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  // a row's icon in a column of one width
  pin: { width: 28, alignItems: 'center', marginRight: 10 },
  pinBadge: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  pinBadgeCorner: { position: 'absolute', right: -8, bottom: -7 },
  nameBox: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, color: colors.text },
  percent: { fontSize: 12, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  amountBox: { alignItems: 'flex-end', paddingLeft: 8 },
  amountOriginal: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  // another currency's amount before the one shown, as large, muted
  amountLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  amountForeign: { color: colors.muted },
  // in "Сбережения": the budget's currency smaller and lighter than the amount
  savingForeign: { fontSize: 13, color: colors.faint },
  amountEmpty: { color: colors.muted, fontSize: 14 },
});

/** A part's amount colored by its tone. */
export const toneStyle = (t?: Tone) => (t === 'over' ? styles.overText : t === 'savings' ? styles.savingsValue : t === 'locked' ? styles.lockedValue : t === 'free' ? styles.freeValue : undefined);
