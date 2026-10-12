import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

export const styles = StyleSheet.create({
  reportLink: { alignSelf: 'flex-start', marginTop: 8 },
  reportText: { fontSize: 14, color: colors.accent },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  month: { paddingBottom: 14 },
  // a grey band across the screen, like the days on the operations
  monthTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, marginBottom: 4,
  },
  monthTitle: { fontSize: 14, fontWeight: '600', color: colors.muted },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  totals: { flexDirection: 'row', marginTop: 6 },
  total: { flex: 1 },
  caption: { fontSize: 12, color: colors.muted },
  totalValue: { fontSize: 15, color: colors.text, marginTop: 2 },
  danger: { color: colors.danger },
  good: { color: colors.income },
  // white with a border: the sections are grey bands in it, like the days on the operations
  details: { marginTop: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', paddingVertical: 4 },
  detailHead: { fontSize: 12, color: colors.muted },
  detailName: { flex: 1, fontSize: 14, color: colors.text, marginRight: 8 },
  detailNum: { width: 92, textAlign: 'right', fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.muted, marginTop: 6 },
  groupRow: { marginTop: 6, marginHorizontal: -10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
  groupTitle: { fontSize: 12, fontWeight: '600', color: colors.muted },
  // "Сбережения" of the opened month: a green band under the categories
  savingsRow: { marginTop: 10, marginHorizontal: -10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.savingsBg },
  savingsTitle: { fontSize: 12, fontWeight: '600', color: colors.income },
  detailText: { fontSize: 14, color: colors.text },
  detailHint: { fontSize: 12, color: colors.muted },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginTop: 4, paddingTop: 6 },
  strong: { fontWeight: '600' },
  muted: { color: colors.muted },
});

