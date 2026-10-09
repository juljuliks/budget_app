import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { formatWithCurrency } from '@/shared/lib/money';
import { openMonthReport } from '@/shared/navigation/sheets';
import { ChevronRightIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import { useMonthReport } from './model/useMonthReport';
import { styles } from './ui/styles';

/**
 * One line opening the report of a past month: "Отложено 1 200 ₾ · могли ещё 410 ₾ ›" (the stats of the month,
 * «История»).
 */
export default function MonthReportRow({ ym }: { ym: string }) {
  const r = useMonthReport(ym);
  // no plan that month: no report
  if (!r || !r.hasPlan) return null;
  const money = (v: number) => formatWithCurrency(v, r.currency);
  return (
    <TouchableOpacity style={styles.row} onPress={() => openMonthReport(ym)} accessibilityHint="Открыть отчёт за месяц">
      <Text style={styles.rowText} numberOfLines={2}>
        {r.saved === null ? `Потрачено ${money(r.spent)}`
          : r.saved >= 0 ? <>Отложено <Masked style={styles.savedInline}>{money(r.saved)}</Masked></>
            : <Text style={styles.over}>Бюджет превышен на {money(-r.saved)}</Text>}
        {r.couldSaveMore > 0 ? <Text style={styles.muted}> · могли ещё {money(r.couldSaveMore)}</Text> : null}
      </Text>
      <ChevronRightIcon color={colors.accent} />
    </TouchableOpacity>
  );
}
