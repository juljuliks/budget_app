import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, space, weight } from '@/shared/theme/tokens';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space[24] },
  pad: { paddingHorizontal: space[16] },
  hint: { fontSize: font.meta, color: colors.muted, marginTop: space[8], lineHeight: 18 },
  empty: { fontSize: font.body, color: colors.muted, paddingHorizontal: space[16], paddingVertical: space[14] },

  row: {
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space[10] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: font.input, color: colors.text },
  delta: { fontSize: font.input, fontWeight: weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  line: { fontSize: font.secondary, color: colors.muted, marginTop: space[4] },
  why: { fontSize: font.secondary, color: colors.text, marginTop: space[8] },
  chart: { marginTop: space[10] },

  allLink: { paddingHorizontal: space[16], paddingVertical: space[12], marginTop: space[8], alignSelf: 'flex-start' },

  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'stretch' },
  barColumn: { justifyContent: 'flex-end', alignItems: 'center' },
  usual: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.border,
  },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barPicked: { borderWidth: 2, borderColor: colors.text },
  barLabel: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 3 },
  barLabelNow: { color: colors.text, fontWeight: weight.semibold },
  barLabelLater: { color: colors.faint },
});
