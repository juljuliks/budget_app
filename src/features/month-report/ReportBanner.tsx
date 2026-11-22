import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MONTHS_NOM } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { openMonthReport, openYearReport } from '@/shared/navigation/sheets';
import { ChevronRightIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { freshMonth, freshYear } from '@/stats/reportWindow';
import { reportView } from './model/reportView';
import { useMonthReport } from './model/useMonthReport';

const days = (n: number) => (n === 0 ? 'последний день' : `ещё ${n} ${plural(n, ['день', 'дня', 'дней'])}`);

function Card({ title, note, onPress }: { title: string; note: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <ChevronRightIcon color={colors.accent} />
    </TouchableOpacity>
  );
}

/**
 * Over the stats while a report is fresh (stats/reportWindow.ts): «Отчёт за октябрь · Отложено 1 150 ₾ · ещё 4 дня ›»
 * (till its month ends — «пока»), «Итоги 2026 · ещё 6 дней ›» — their stories. Past that the reports are pages.
 */
export default function ReportBanner() {
  const now = new Date();
  const month = freshMonth(now);
  const year = freshYear(now);
  const { report: r } = useMonthReport(month?.ym ?? null);
  const v = r && r.hasPlan ? reportView(r, r.currency) : null;
  const ongoing = month !== null && month.ym === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return (
    <>
      {month && v ? (
        <Card
          title={`Отчёт за ${MONTHS_NOM[Number(month.ym.slice(5)) - 1]}`}
          note={[r!.saved !== null && r!.saved >= 0 ? `${ongoing ? 'Пока отложено' : 'Отложено'} ${v.savedMoney(r!.saved)}` : '', days(month.daysLeft)].filter(Boolean).join(' · ')}
          onPress={() => openMonthReport(month.ym)}
        />
      ) : null}
      {year ? <Card title={`Итоги ${year.year}`} note={days(year.daysLeft)} onPress={() => openYearReport(year.year)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.accentBg,
  },
  text: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  note: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
