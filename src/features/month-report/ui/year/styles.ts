// «Итоги года»: the look of its screens.
import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { SAVINGS } from '../styles';

export const y = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  caption: { fontSize: 14, color: colors.muted },
  center: { textAlign: 'center' },
  big: { fontSize: 44, fontWeight: '700', color: SAVINGS, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  cell: { width: '48%', padding: 12, borderRadius: 12, backgroundColor: colors.surface, gap: 2 },
  cellValue: { fontSize: 16, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  gap: { gap: 10 },
  // the bars by month
  chart: { height: 180, flexDirection: 'row', alignItems: 'stretch', gap: 4, marginTop: 12 },
  col: { flex: 1, alignItems: 'center' },
  half: { flex: 1, width: '100%', alignItems: 'center' },
  up: { justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: 3, backgroundColor: SAVINGS },
  barDown: { backgroundColor: colors.warn },
  pale: { opacity: 0.5 },
  grey: { opacity: 0.4 },
  goal: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.muted },
  axis: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  monthLabel: { fontSize: 10, color: colors.muted, marginTop: 4 },
  // the table
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  th: { fontSize: 12, color: colors.muted },
  td: { flex: 1, fontSize: 13, color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  tdName: { flex: 1.3, textAlign: 'left' },
  tdPct: { flex: 0.6 },
  strong: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1 },
  name: { fontSize: 15, color: colors.text },
  value: { fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  note: { marginTop: 8 },
  fund: { gap: 4 },
  good: { color: colors.income },
  bad: { color: colors.warn },
});
