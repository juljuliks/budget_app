// The plan screen's look, one for all its parts.
import { StyleSheet } from 'react-native';
import { chart, colors } from '@/shared/theme/theme';
import type { Tone } from '../model/planView';
import { BAR_HEIGHT, LOCK_BADGE, RING_LOCKED } from './palette';
import { font, layout, radius, space, weight } from '@/shared/theme/tokens';

export const styles = StyleSheet.create({
  share: { marginTop: space[4] },
  lockTitle: { flexDirection: 'row', alignItems: 'center', gap: space[6], marginTop: space[12] },
  lockMode: { marginLeft: 'auto', width: 168 },
  lockLabel: { marginBottom: 0, marginTop: 0, flexShrink: 1 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: space[8], marginTop: space[6] },
  lockOwn: { fontSize: font.secondary, color: colors.muted },
  lockInput: { flex: 1, paddingVertical: space[6] },
  // white like the stats: the sections' grey bands stand out
  screen: { flex: 1, backgroundColor: colors.bg },
  // room under the last row for the "+"
  content: { paddingHorizontal: space[16], paddingBottom: layout.fabClearance },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  budgetBox: { marginBottom: space[8], padding: space[14], borderRadius: radius.lg, backgroundColor: colors.surface },
  budgetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  // the pencil at the top, by the amount (not between it and the original one under it)
  budgetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[8], paddingVertical: space[2] },
  pencil: { marginTop: space[6] },
  budgetValue: { fontSize: font.heading, fontWeight: weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  left: { textAlign: 'left' },
  budgetAmounts: { alignItems: 'flex-end' },
  budgetOriginal: { fontSize: font.meta, color: colors.muted, fontVariant: ['tabular-nums'] },
  barBox: { marginTop: space[10] },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: radius.xs,
    overflow: 'hidden',
    gap: space[2],
    backgroundColor: chart.track,
  },
  lockBadgeBox: {
    position: 'absolute',
    top: (BAR_HEIGHT - LOCK_BADGE) / 2,
    height: LOCK_BADGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: LOCK_BADGE,
    height: LOCK_BADGE,
    borderRadius: LOCK_BADGE / 2,
    backgroundColor: RING_LOCKED,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // the parts as a legend: a line each, the amounts and shares in columns
  parts: { gap: space[6], marginTop: space[10] },
  part: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  legendBox: { width: 16, flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: radius.xs },
  legendPair: { flexDirection: 'row', alignItems: 'center' },
  // the second dot covers a third of the first, a ring of the card's colour between them
  legendOver: {
    width: 12,
    height: 12,
    borderRadius: radius.sm,
    marginLeft: -5,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  partLabel: { fontSize: font.secondary, color: colors.muted },
  // the amounts right-aligned at the edge; the shares in a column right by the names.
  // center, not baseline: the overspend's ⓘ is a drawing, and baseline drops it under the amount
  partValues: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space[6] },
  partValue: {
    textAlign: 'right',
    fontSize: font.secondary,
    fontWeight: weight.semibold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  partForeign: { fontSize: font.meta, color: colors.faint, fontVariant: ['tabular-nums'] },
  // the legend's names laid out unseen: the widest sets the names' column
  measure: { position: 'absolute', opacity: 0, alignItems: 'flex-start' },
  // a share ("43%") or a word ("сэкономлено") right by the name
  partNote: {
    minWidth: 34,
    textAlign: 'right',
    fontSize: font.meta,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  note: { fontSize: font.caption, color: colors.muted, marginTop: space[8] },
  overText: { color: colors.warn },
  savingsValue: { color: RING_LOCKED },
  lockedValue: { color: RING_LOCKED },
  lockedPart: { backgroundColor: RING_LOCKED, alignItems: 'center', justifyContent: 'center' },
  freeValue: { color: colors.income },
  // "Что значат значки" under every section
  iconsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[6],
    alignSelf: 'flex-start',
    paddingVertical: space[4],
    marginTop: space[16],
  },
  iconsLinkText: { fontSize: font.secondary, color: colors.accent },
  caption: { fontSize: font.meta, color: colors.muted, textAlign: 'center' },
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
  // as the stats' headers: the amount dark, " · 23%" muted
  groupShare: { color: colors.muted },
  groupTotal: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  // a row charged in a later month only: faded
  later: { opacity: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[10],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  // a row's icon in a column of one width
  pin: { width: 28, alignItems: 'center', marginRight: space[10] },
  nameBox: { flex: 1, marginRight: space[8] },
  name: { fontSize: font.body, color: colors.text },
  percent: { fontSize: font.caption, color: colors.muted, marginTop: space[2], fontVariant: ['tabular-nums'] },
  // as the stats' rows: "1 200 ₾ · 10%" in one line on the name's, the share muted
  amount: { fontSize: font.meta, color: colors.text, fontVariant: ['tabular-nums'] },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    paddingTop: space[2],
    paddingLeft: space[8],
  },
  amountOriginal: { fontSize: font.meta, color: colors.muted, fontVariant: ['tabular-nums'] },
  // another currency's amount before the one shown, as large, muted
  amountLine: { flexDirection: 'row', alignItems: 'baseline', gap: space[4] },
  // the amount in another currency ("(300 $)") before the screen's one: smaller and lighter, in every row of the plan
  amountForeign: { fontSize: font.meta, color: colors.faint },
  amountEmpty: { color: colors.muted },
});

/** A part's amount colored by its tone. */
export const toneStyle = (t?: Tone) =>
  t === 'over'
    ? styles.overText
    : t === 'savings'
      ? styles.savingsValue
      : t === 'locked'
        ? styles.lockedValue
        : t === 'free'
          ? styles.freeValue
          : undefined;
