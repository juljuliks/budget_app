import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24 },
  pad: { paddingHorizontal: 16 },
  modes: { marginTop: 16 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 18 },
  empty: { fontSize: 15, color: colors.muted, paddingHorizontal: 16, paddingVertical: 14 },

  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  delta: { fontSize: 16, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  line: { fontSize: 14, color: colors.muted, marginTop: 4 },
  why: { fontSize: 14, color: colors.text, marginTop: 8 },
  chart: { marginTop: 10 },

  legend: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 12, color: colors.muted },
  allLink: { paddingHorizontal: 16, paddingVertical: 12, marginTop: 8, alignSelf: 'flex-start' },

  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'stretch' },
  barColumn: { justifyContent: 'flex-end', alignItems: 'center' },
  usual: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.border },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barPicked: { borderWidth: 2, borderColor: colors.text },
  barLabel: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 3 },
  barLabelNow: { color: colors.text, fontWeight: '600' },
  barLabelLater: { color: colors.faint },
});
