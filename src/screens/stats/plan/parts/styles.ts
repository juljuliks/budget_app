// The plan screen's look, one for all its parts.
import { StyleSheet } from 'react-native';
import { chart, colors } from '@/shared/theme/theme';
import type { Tone } from '../model/planView';
import { BAR_HEIGHT, LOCK_BADGE, RING_LOCKED } from './palette';

export const styles = StyleSheet.create({
  share: { marginTop: 4 },
  lockTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  lockMode: { marginLeft: 'auto', width: 120 },
  lockLabel: { marginBottom: 0, marginTop: 0, flexShrink: 1 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lockOwn: { fontSize: 14, color: colors.muted },
  lockInput: { flex: 1, paddingVertical: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  switchLabel: { fontSize: 15, color: colors.text, flex: 1 },
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
  parts: { flexDirection: 'row', gap: 8, marginTop: 10 },
  part: { flex: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendPair: { flexDirection: 'row', alignItems: 'center' },
  // the second dot covers a third of the first, a ring of the card's colour between them
  legendOver: { width: 12, height: 12, borderRadius: 6, marginLeft: -5, borderWidth: 2, borderColor: colors.surface },
  partLabel: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  partValue: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2, fontVariant: ['tabular-nums'] },
  partNote: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.muted, marginTop: 8 },
  overText: { color: colors.warn },
  savingsValue: { color: RING_LOCKED },
  lockedValue: { color: RING_LOCKED },
  lockedPart: { backgroundColor: RING_LOCKED, alignItems: 'center', justifyContent: 'center' },
  freeValue: { color: colors.income },
  pinNote: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  caption: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 12 },
  // a grey band across the screen, sticking on top as the days on the operations do
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  groupShare: { color: colors.muted, fontWeight: '400' },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  pin: { paddingRight: 8 },
  nameBox: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, color: colors.text },
  percent: { fontSize: 12, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  amountBox: { alignItems: 'flex-end', paddingLeft: 8 },
  amountOriginal: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  amountEmpty: { color: colors.muted, fontSize: 14 },
});

/** A part's amount colored by its tone. */
export const toneStyle = (t?: Tone) => (t === 'over' ? styles.overText : t === 'savings' ? styles.savingsValue : t === 'locked' ? styles.lockedValue : t === 'free' ? styles.freeValue : undefined);
