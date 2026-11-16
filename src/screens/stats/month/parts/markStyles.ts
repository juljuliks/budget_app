// The payments' marks over the month's bar.
import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';

export const markStyles = StyleSheet.create({
  row: { height: 32, marginTop: 8 },
  mark: { position: 'absolute', bottom: 0, width: 26, alignItems: 'center' },
  // still ahead: faded
  ahead: { opacity: 0.4 },
  badge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 13 },
  // its stem down to the bar
  stem: { width: 1, height: 6, backgroundColor: colors.faint },
  status: {
    position: 'absolute', right: -4, bottom: -3, width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  paid: { backgroundColor: colors.income },
  missed: { backgroundColor: colors.warn },
  statusText: { fontSize: 8, lineHeight: 10, fontWeight: '700', color: colors.bg },
  count: {
    position: 'absolute', right: -5, top: -4, minWidth: 13, height: 13, borderRadius: 7, paddingHorizontal: 2,
    backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 9, lineHeight: 11, fontWeight: '700', color: colors.bg },
  // a payment whose day is past and not paid, under the bar
  missedLine: { fontSize: 13, fontWeight: '600', color: colors.warn, marginTop: 2 },
});
