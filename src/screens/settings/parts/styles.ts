import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

export const styles = StyleSheet.create({
  hint: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 10 },
  block: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  flex: { flex: 1 },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowLabel: { flex: 1, fontSize: 16, color: colors.text },
  label: { fontSize: 16, color: colors.text },
  chevron: { fontSize: 20, color: colors.muted, width: 20, textAlign: 'right' },
});
