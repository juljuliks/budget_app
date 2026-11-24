import { StyleSheet } from 'react-native';
import { colors } from './theme';
import { font, radius, space, weight } from './tokens';

/** Shared look of form fields (add transaction, category editor, input dialogs). */
export const formStyles = StyleSheet.create({
  label: {
    fontSize: font.meta,
    fontWeight: weight.semibold,
    color: colors.muted,
    marginTop: space[16],
    marginBottom: space[6],
    textTransform: 'uppercase',
  },
  input: {
    fontSize: font.input,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space[12],
    paddingVertical: space[10],
  },
  hint: { color: colors.muted, marginTop: space[8], fontSize: font.meta },
  /** list section header (day in the transactions list, type in categories) */
  sectionHeader: {
    paddingHorizontal: space[16],
    paddingVertical: space[6],
    backgroundColor: colors.surface,
    color: colors.muted,
    fontSize: font.meta,
    fontWeight: weight.semibold,
  },
});
