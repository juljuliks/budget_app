import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

/** A category's page of «Динамика трат». */
export const detailStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16 },
  spent: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  spentWhen: { fontSize: 15, fontWeight: '400', color: colors.muted },
  delta: { fontSize: 16, fontWeight: '600', color: colors.text },
  line: { fontSize: 14, color: colors.muted, marginTop: 4 },
  chart: { marginTop: 14 },
  point: { fontSize: 14, color: colors.text, marginTop: 10, minHeight: 20 },
  block: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 16, color: colors.text, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell: { width: '50%' },
  merchant: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  merchantName: { flex: 1, marginRight: 12 },
  operations: { paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
