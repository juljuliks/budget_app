import React, { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { currentYm } from '@/db/plans';
import { useDisplayCurrency } from '@/displayCurrency';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { monthDays } from '@/shared/lib/dateRange';
import { navigateWhenReady } from '@/shared/navigation/navigation';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { reportTitle, reportView } from './model/reportView';
import { useMonthReport } from './model/useMonthReport';
import GoodBlock from './ui/GoodBlock';
import ImproveBlock from './ui/ImproveBlock';
import ReportHero from './ui/ReportHero';
import { styles } from './ui/styles';

/** The month's report in a sheet (sheets.ts → openMonthReport): from the notification, «История», the stats. */
export default function MonthReportSheet({ ym, onClose }: { ym: string | null; onClose: () => void }) {
  const r = useMonthReport(ym);
  const currency = useDisplayCurrency();
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  const v = r ? reportView(r, currency) : null;

  // the month's operations without a category, on the operations page
  function sortOut() {
    if (!ym) return;
    onClose();
    navigateWhenReady({ name: 'Main', params: { screen: 'Transactions', params: { category: 'none', range: monthDays(ym), nonce: Date.now(), from: 'Stats' } } } as never);
  }

  return (
    <BottomSheet visible={ym !== null} onClose={onClose} title={ym ? `Отчёт · ${reportTitle(ym)}` : ''}>
      {!r || !v ? <ActivityIndicator style={styles.loading} /> : !r.hasPlan ? (
        // an old notification of a month whose plan is gone
        <Text style={[styles.hint, styles.content]}>Плана на этот месяц не было — отчёта нет.</Text>
      ) : (
        <SheetScrollView contentContainerStyle={styles.content}>
          <ReportHero v={v} />
          {v.improve ? <ImproveBlock v={v} currency={currency} onPlan={setPlanTarget} onSortOut={sortOut} /> : null}
          {v.good ? <GoodBlock v={v} /> : null}
        </SheetScrollView>
      )}
      {/* planned into the report's own month */}
      <PlanAmountModal ym={ym ?? currentYm()} currency={currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={() => setPlanTarget(null)} />
    </BottomSheet>
  );
}
