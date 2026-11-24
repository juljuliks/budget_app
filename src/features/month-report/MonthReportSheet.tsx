import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { currentYm } from '@/db/plans';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { PlanAmountModal, PlanAmountTarget } from '@/entities/plan';
import { monthDays } from '@/shared/lib/dateRange';
import { navigateWhenReady, openCategory } from '@/shared/navigation/navigation';
import { openMonthClose } from '@/shared/navigation/sheets';
import Loading from '@/shared/ui/Loading';
import StoryPager from '@/shared/ui/StoryPager';
import { reportTitle, reportView } from './model/reportView';
import { useMonthReport } from './model/useMonthReport';
import LateFunds from './ui/LateFunds';
import GoodBlock from './ui/GoodBlock';
import ImproveBlock from './ui/ImproveBlock';
import ImpulseBlock from './ui/ImpulseBlock';
import OutsideBlock from './ui/OutsideBlock';
import ReportHero from './ui/ReportHero';
import { styles } from './ui/styles';

/**
 * The month's report as stories (sheets.ts → openMonthReport): from the notification, «История», the stats. «Отложено»,
 * «Что можно улучшить», «Вне плана сверх доли», «Что уже хорошо», «Импульсивные покупки» — one without data left out.
 */
export default function MonthReportSheet({ ym, onClose }: { ym: string | null; onClose: () => void }) {
  const { report: r, late, failed, load } = useMonthReport(ym);
  const currency = useDisplayCurrency();
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  const v = r ? reportView(r, currency) : null;

  // the report closes, then `go` (one screen at a time)
  const leave = (go: () => void) => {
    if (!ym) return;
    onClose();
    setTimeout(go, 250);
  };
  // "Подвести итоги ›": the month's "Итоги"
  const closeMonth = () => leave(() => openMonthClose(ym!));
  // the month's operations without a category / without an answer to "Обдуманная" / "Импульсивная"
  const toOperations = (params: object) => () => {
    if (!ym) return;
    onClose();
    navigateWhenReady({
      name: 'Main',
      params: { screen: 'Transactions', params: { ...params, range: monthDays(ym), nonce: Date.now(), from: 'Stats' } },
    } as never);
  };

  const pages =
    !r || !v
      ? []
      : !r.hasPlan
        ? [
            // an old notification of a month whose plan is gone
            <Text key="none" style={styles.hint}>
              Плана на этот месяц не было — отчёта нет.
            </Text>,
          ]
        : [
            <View key="saved" style={styles.content}>
              <ReportHero v={v} onCloseMonth={closeMonth} />
              <LateFunds late={late} onOpen={(id) => leave(() => openCategory(id))} />
            </View>,
            ...(v.limits ? [<ImproveBlock key="improve" v={v} />] : []),
            ...(v.outside
              ? [
                  <OutsideBlock
                    key="outside"
                    v={v}
                    currency={currency}
                    onPlan={setPlanTarget}
                    onSortOut={toOperations({ category: 'none' })}
                  />,
                ]
              : []),
            ...(v.good ? [<GoodBlock key="good" v={v} />] : []),
            ...(r.impulse
              ? [
                  <ImpulseBlock
                    key="impulse"
                    m={r.impulse}
                    money={v.money}
                    onMark={toOperations({ unanswered: true })}
                    month={ym!}
                  />,
                ]
              : []),
          ];

  return (
    <>
      <StoryPager
        visible={ym !== null}
        onClose={onClose}
        title={ym ? `Отчёт · ${reportTitle(ym)}` : ''}
        pages={pages}
        placeholder={!r || !v ? <Loading inline style={styles.loading} failed={failed} onRetry={load} /> : undefined}
      />
      {/* planned into the report's own month */}
      <PlanAmountModal
        ym={ym ?? currentYm()}
        currency={currency}
        target={planTarget}
        onClose={() => setPlanTarget(null)}
        onSaved={() => setPlanTarget(null)}
        // to the operations: the report closes too (it would cover them)
        onLeave={() => {
          setPlanTarget(null);
          onClose();
        }}
      />
    </>
  );
}
