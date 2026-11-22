import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { monthDays } from '@/shared/lib/dateRange';
import { navigateWhenReady, openCategory } from '@/shared/navigation/navigation';
import { openMonthClose } from '@/shared/navigation/sheets';
import Loading from '@/shared/ui/Loading';
import { colors } from '@/shared/theme/theme';
import { reportView } from './model/reportView';
import { useMonthReport } from './model/useMonthReport';
import { useReportCurrency } from './model/useReportCurrency';
import CurrencyChoice from './ui/CurrencyChoice';
import GoodBlock from './ui/GoodBlock';
import ImproveBlock from './ui/ImproveBlock';
import ImpulseBlock from './ui/ImpulseBlock';
import LateFunds from './ui/LateFunds';
import OutsideBlock from './ui/OutsideBlock';
import ReportHero from './ui/ReportHero';
import { PAGE_INSET } from './ui/ReportBlock';
import { styles as report } from './ui/styles';

/**
 * A month's report as a page («Отчёт за месяц ›» in «История» and a past month's stats): the same blocks as its
 * stories, one under another — «Отложено» first, the others each under its grey section; in the budget's currency or the
 * system one.
 */
export default function MonthReportPage({ ym }: { ym: string }) {
  const cur = useReportCurrency(ym);
  // both currencies read up front: picking the other one only shows it (no loading, the page stays)
  const inBudget = useMonthReport(cur.budget ? ym : null, cur.budget ?? undefined);
  const inSystem = useMonthReport(cur.budget && cur.budget !== cur.system ? ym : null, cur.system);
  const { report: r, late, failed, load } = cur.shown === cur.budget || !inSystem.report ? inBudget : inSystem;
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  if (!r || !cur.shown) return <Loading failed={failed} onRetry={load} />;
  if (!r.hasPlan) return <Text style={[report.hint, styles.content]}>Плана на этот месяц не было — отчёта нет.</Text>;
  const v = reportView(r, r.currency);
  const toOperations = (params: object) => () => navigateWhenReady({ name: 'Main', params: { screen: 'Transactions', params: {
    ...params, range: monthDays(ym), nonce: Date.now(), from: 'Stats' } } } as never);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} testID="month-report">
      {cur.budget ? <CurrencyChoice budget={cur.budget} system={cur.system} value={cur.shown} onChange={cur.pick} /> : null}
      <ReportHero v={v} onCloseMonth={() => openMonthClose(ym)} />
      <LateFunds late={late} onOpen={openCategory} />
      {v.limits ? <ImproveBlock v={v} page /> : null}
      {v.outside ? <OutsideBlock v={v} currency={r.currency} onPlan={setPlanTarget} onSortOut={toOperations({ category: 'none' })} page /> : null}
      {v.good ? <GoodBlock v={v} page /> : null}
      {r.impulse ? <ImpulseBlock m={r.impulse} money={v.money} onMark={toOperations({ unanswered: true })} page month={ym} /> : null}
      <PlanAmountModal ym={ym} currency={r.currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={() => setPlanTarget(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: PAGE_INSET, paddingBottom: 32 },
});
