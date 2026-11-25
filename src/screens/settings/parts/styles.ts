import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, space, weight } from '@/shared/theme/tokens';

export const styles = StyleSheet.create({
  hint: { fontSize: font.meta, color: colors.muted, marginTop: space[2], marginBottom: space[10] },
  block: {
    paddingHorizontal: space[20],
    paddingVertical: space[14],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[20],
    paddingVertical: space[16],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[8] },
  value: { fontSize: font.body, fontWeight: weight.bold },
  after: { marginTop: space[10], marginBottom: 0 },
  rowLabel: { flex: 1, fontSize: font.input, color: colors.text },
  label: { fontSize: font.input, color: colors.text },
  chevron: { fontSize: font.heading, color: colors.muted, width: 20, textAlign: 'right' },
});
