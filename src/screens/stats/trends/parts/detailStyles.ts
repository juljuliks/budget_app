import { StyleSheet } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, radius, space, weight } from '@/shared/theme/tokens';

/** A category's page of «Динамика трат». */
export const detailStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space[16] },
  spent: { fontSize: 22, fontWeight: weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  spentWhen: { fontSize: font.body, fontWeight: weight.regular, color: colors.muted },
  delta: { fontSize: font.input, fontWeight: weight.semibold, color: colors.text },
  line: { fontSize: font.secondary, color: colors.muted, marginTop: space[4] },
  chart: { marginTop: space[14] },
  point: { fontSize: font.secondary, color: colors.text, marginTop: space[10], minHeight: 20 },
  block: { paddingVertical: space[12], borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { fontSize: font.meta, color: colors.muted },
  value: { fontSize: font.input, color: colors.text, marginTop: space[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[12] },
  cell: { width: '50%' },
  merchant: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[8] },
  merchantName: { flex: 1, marginRight: space[12] },
  /** «Месяц | Год | Всё время» over the merchants */
  periods: { marginTop: space[8], marginBottom: space[4] },
  /** «Мало данных»: too few months to tell frequent from rare */
  few: {
    fontSize: font.secondary,
    color: colors.warn,
    backgroundColor: colors.warnBg,
    borderRadius: radius.md,
    padding: space[12],
    marginTop: space[16],
    lineHeight: 19,
  },
  operations: { paddingVertical: space[14], borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
