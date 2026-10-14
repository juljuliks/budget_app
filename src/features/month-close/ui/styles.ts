import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

export const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  steps: { paddingHorizontal: 20 },
  block: { borderRadius: 14, padding: 14, gap: 8, backgroundColor: colors.surface },
  savings: { backgroundColor: colors.savingsBg },
  funds: { backgroundColor: colors.fundBg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  headText: { fontSize: 16, fontWeight: '600', color: colors.text, flexShrink: 1 },
  headOver: { color: colors.warn },
  headSaved: { color: colors.savingsText },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  lineText: { fontSize: 14, color: colors.text, flexShrink: 1 },
  lineValue: { fontSize: 14, fontWeight: '500', color: colors.text },
  rule: { height: 1, backgroundColor: colors.border },
  muted: { fontSize: 13, color: colors.muted },
  question: { fontSize: 15, fontWeight: '500', color: colors.text, marginTop: 2 },
  fund: { gap: 6 },
  fundRule: { borderBottomWidth: 1, borderBottomColor: colors.fundTrack, paddingBottom: 10 },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 12 },
  actions: { paddingHorizontal: 16 },
  empty: { fontSize: 15, color: colors.muted, paddingHorizontal: 20, paddingVertical: 12 },
});
