import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, radius, space, weight } from '@/shared/theme/tokens';

export const styles = StyleSheet.create({
  yearLink: { marginBottom: space[12] },
  reportLink: { alignSelf: 'flex-start', marginTop: space[8] },
  reportText: { fontSize: font.secondary, color: colors.accent },
  links: { flexDirection: 'row', gap: space[20] },
  // "Итоги не подведены"
  openClose: {
    marginTop: space[10],
    gap: space[4],
    borderRadius: radius.md,
    paddingHorizontal: space[12],
    paddingVertical: space[10],
    backgroundColor: colors.warnBg,
  },
  openCloseText: { fontSize: font.secondary, color: colors.warn },
  content: { paddingHorizontal: space[16], paddingBottom: space[32] },
  hint: { color: colors.muted, fontSize: font.secondary, textAlign: 'center', marginVertical: space[12] },
  month: { paddingBottom: space[14] },
  // a month of the year with nothing to show
  empty: { opacity: 0.45, paddingBottom: space[4] },
  // a grey band across the screen, like the days on the operations
  monthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: -16,
    paddingHorizontal: space[16],
    paddingVertical: space[8],
    backgroundColor: colors.surface,
    marginBottom: space[4],
  },
  monthTitle: { fontSize: font.secondary, fontWeight: weight.semibold, color: colors.muted },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  totals: { flexDirection: 'row', marginTop: space[6] },
  total: { flex: 1 },
  caption: { fontSize: font.caption, color: colors.muted },
  totalValue: { fontSize: font.body, color: colors.text, marginTop: space[2] },
  danger: { color: colors.danger },
  good: { color: colors.income },
  // white with a border: the sections are grey bands in it, like the days on the operations
  details: {
    marginTop: space[10],
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space[10],
    overflow: 'hidden',
  },
  detailRow: { flexDirection: 'row', paddingVertical: space[4] },
  detailHead: { fontSize: font.caption, color: colors.muted },
  detailName: { flex: 1, fontSize: font.secondary, color: colors.text, marginRight: space[8] },
  detailNum: {
    width: 92,
    textAlign: 'right',
    fontSize: font.secondary,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  note: { fontSize: font.caption, color: colors.muted, marginTop: space[6] },
  groupRow: {
    marginTop: space[6],
    marginHorizontal: -10,
    paddingHorizontal: space[10],
    paddingVertical: space[6],
    backgroundColor: colors.surface,
  },
  groupTitle: { fontSize: font.caption, fontWeight: weight.semibold, color: colors.muted },
  // "Сбережения" of the opened month: a green band under the categories
  savingsRow: {
    marginTop: space[10],
    marginHorizontal: -10,
    paddingHorizontal: space[10],
    paddingVertical: space[6],
    backgroundColor: colors.savingsBg,
  },
  savingsTitle: { fontSize: font.caption, fontWeight: weight.semibold, color: colors.income },
  detailText: { fontSize: font.secondary, color: colors.text },
  detailHint: { fontSize: font.caption, color: colors.muted },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: space[4],
    paddingTop: space[6],
  },
  strong: { fontWeight: weight.semibold },
  muted: { color: colors.muted },
});
