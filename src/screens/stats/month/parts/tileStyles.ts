// The three tiles under the month's bar (MonthTiles) and the list under them.
import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

export const tileStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tile: {
    flex: 1, minWidth: 0, padding: 10, borderRadius: 12, gap: 2,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.surface,
  },
  // the one whose list is open
  picked: { borderColor: colors.accent },
  warnTile: { backgroundColor: colors.warnBg, borderColor: colors.warnBg },
  title: { fontSize: 12, color: colors.muted },
  total: { fontSize: 18, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  sub: { fontSize: 12, color: colors.muted },
  warnText: { color: colors.warn },
  item: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  label: { flexShrink: 1, fontSize: 14, color: colors.text },
  amount: { fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.muted },
  over: { color: colors.warn, fontWeight: '600' },
});
