import React, { useState } from 'react';
import { Text } from 'react-native';
import { currentYm } from '@/db/plans';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { monthDays } from '@/shared/lib/dateRange';
import { navigateWhenReady } from '@/shared/navigation/navigation';
import { openMonthClose } from '@/shared/navigation/sheets';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import Loading from '@/shared/ui/Loading';
import { reportTitle, reportView } from './model/reportView';
import { useMonthReport } from './model/useMonthReport';
import GoodBlock from './ui/GoodBlock';
import ImproveBlock from './ui/ImproveBlock';
import ReportHero from './ui/ReportHero';
import { styles } from './ui/styles';

/** The month's report in a sheet (sheets.ts → openMonthReport): from the notification, «История», the stats. */
export default function MonthReportSheet({ ym, onClose }: { ym: string | null; onClose: () => void }) {
  const { report: r, failed, load } = useMonthReport(ym);
  const currency = useDisplayCurrency();
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  const v = r ? reportView(r, currency) : null;

  // "Подвести итоги ›": the report closes, the month's "Итоги" open (one sheet at a time)
  function closeMonth() {
    if (!ym) return;
    onClose();
    setTimeout(() => openMonthClose(ym), 250);
  }

  // the month's operations without a category, on the operations page
  function sortOut() {
    if (!ym) return;
    onClose();
    navigateWhenReady({ name: 'Main', params: { screen: 'Transactions', params: { category: 'none', range: monthDays(ym), nonce: Date.now(), from: 'Stats' } } } as never);
  }

  return (
    <BottomSheet visible={ym !== null} onClose={onClose} title={ym ? `Отчёт · ${reportTitle(ym)}` : ''}>
      {!r || !v ? <Loading inline style={styles.loading} failed={failed} onRetry={load} /> : !r.hasPlan ? (
        // an old notification of a month whose plan is gone
        <Text style={[styles.hint, styles.content]}>Плана на этот месяц не было — отчёта нет.</Text>
      ) : (
        <SheetScrollView contentContainerStyle={styles.content}>
          <ReportHero v={v} onCloseMonth={closeMonth} />
          {v.improve ? <ImproveBlock v={v} currency={currency} onPlan={setPlanTarget} onSortOut={sortOut} /> : null}
          {v.good ? <GoodBlock v={v} /> : null}
        </SheetScrollView>
      )}
      {/* planned into the report's own month */}
      <PlanAmountModal
        ym={ym ?? currentYm()} currency={currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={() => setPlanTarget(null)}
        // to the operations: the report closes too (it would cover them)
        onLeave={() => { setPlanTarget(null); onClose(); }}
      />
    </BottomSheet>
  );
}
