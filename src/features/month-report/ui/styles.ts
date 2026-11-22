// The month report's look, one for all its parts.
import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

/** what was put aside: the savings' teal */
export const SAVINGS = '#0d9488';

export const styles = StyleSheet.create({
  loading: { marginVertical: 32 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  hero: { alignItems: 'center', paddingVertical: 8, gap: 2 },
  heroValue: { fontSize: 44, fontWeight: '700', color: SAVINGS, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  blockCaption: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 14, color: colors.muted },
  block: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 6 },
  blockHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  blockTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  blockValue: { fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineLabel: { flex: 1, fontSize: 14, color: colors.text },
  lineValue: { fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  lineValues: { alignItems: 'flex-end' },
  lineYear: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  infoLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrinkLabel: { flex: 0, flexShrink: 1 },
  yearInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  goodBlock: { backgroundColor: '#ECFDF5' },
  lineStrong: { fontWeight: '600' },
  indent: { paddingLeft: 12, color: colors.muted },
  link: { fontSize: 14, color: colors.accent },
  from: { alignSelf: 'stretch', marginTop: 10, gap: 4 },
  fromLabel: { fontSize: 13, color: colors.muted },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12 },
  catText: { flex: 1 },
  catName: { fontSize: 14, color: colors.text },
  catNote: { fontSize: 12, color: colors.muted },
  good: { color: colors.income },
  over: { color: colors.warn },
  bad: { color: colors.danger },
  muted: { color: colors.muted },
  row: {
    marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: colors.surface,
  },
  rowText: { flex: 1, fontSize: 14, color: colors.text },
  overBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginLeft: 12, marginTop: 4, gap: 2 },
  overPlan: { backgroundColor: colors.accent },
  overPast: { backgroundColor: colors.warn },
  numbers: { flexDirection: 'row', alignSelf: 'stretch', gap: 8, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.surface },
  numberCell: { flex: 1, gap: 2 },
  numberLabel: { fontSize: 13, color: colors.muted },
  numberValue: { fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  // a block on a report's page: under its section, no card
  pageBlock: { gap: 6, paddingTop: 6 },
  savedInline: { fontSize: 14, fontWeight: '600', color: SAVINGS },
});
