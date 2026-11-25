// «Итоги года»: the look of its screens.
import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { SAVINGS } from '../styles';
import { font, radius, space, weight } from '@/shared/theme/tokens';

export const y = StyleSheet.create({
  title: { fontSize: font.heading, fontWeight: weight.bold, color: colors.text },
  caption: { fontSize: font.secondary, color: colors.muted },
  center: { textAlign: 'center' },
  big: {
    fontSize: font.hero,
    fontWeight: weight.bold,
    color: SAVINGS,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8], marginTop: space[20] },
  cell: { width: '48%', padding: space[12], borderRadius: radius.lg, backgroundColor: colors.surface, gap: space[2] },
  cellValue: { fontSize: font.input, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  gap: { gap: space[10] },
  // the bars by month
  chart: { height: 180, flexDirection: 'row', alignItems: 'stretch', gap: space[4], marginTop: space[12] },
  col: { flex: 1, alignItems: 'center' },
  half: { flex: 1, width: '100%', alignItems: 'center' },
  up: { justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: radius.xs, backgroundColor: SAVINGS },
  barDown: { backgroundColor: colors.warn },
  pale: { opacity: 0.5 },
  grey: { opacity: 0.4 },
  goal: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.muted,
  },
  axis: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  monthLabel: { fontSize: font.micro, color: colors.muted, marginTop: space[4] },
  // the table
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[6],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  th: { fontSize: font.caption, color: colors.muted },
  td: { flex: 1, fontSize: font.meta, color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  tdName: { flex: 1.3, textAlign: 'left' },
  tdPct: { flex: 0.6 },
  strong: { fontWeight: weight.bold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  rowText: { flex: 1 },
  name: { fontSize: font.body, color: colors.text },
  value: { fontSize: font.body, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  note: { marginTop: space[8] },
  bandRight: { fontSize: font.meta, fontWeight: weight.semibold, color: colors.text },
  fund: { gap: space[4] },
  good: { color: colors.income },
  bad: { color: colors.warn },
});
