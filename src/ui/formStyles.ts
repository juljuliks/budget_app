import { StyleSheet } from 'react-native';
import { colors } from './theme';

/** Shared look of form fields (add transaction, category editor, input dialogs). */
export const formStyles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 16, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  hint: { color: colors.muted, marginTop: 8, fontSize: 13 },
  /** list section header (day in the transactions list, type in categories) */
  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.surface,
    color: colors.muted, fontSize: 13, fontWeight: '600',
  },
});
