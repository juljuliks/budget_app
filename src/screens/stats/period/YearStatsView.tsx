import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { Currency } from '@/db/fx';
import { yearCurrency } from '@/db/yearReport';
import { CurrencyChoice, ImpulseBlock, useReportCurrency, useYearReport, YearBars, YearNumbers, YearSavings, YearTable } from '@/features/month-report';
import { DayRange, dayKeyOf } from '@/shared/lib/dateRange';
import { formatWithCurrency } from '@/shared/lib/money';
import { navigateWhenReady, openMonthReportPage, useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import Loading from '@/shared/ui/Loading';
import StickyScrollView from '@/shared/ui/StickyScrollView';
import { periodView } from './model/periodView';
import { usePeriodData } from './model/usePeriodData';
import InfoSheet from './parts/InfoSheet';
import { styles } from './parts/styles';
import type { Info } from './parts/types';
import { yearSpending } from './parts/yearSpending';

/** the year's budget currency: its last month's with a budget (the key — the year) */
const yearBudget = (year: string, system: Currency) => yearCurrency(Number(year), system);

/**
 * «Статистика за год» — the year's report on one page: what was put aside (no section), «По месяцам» (the bars, the
 * table of the months), «Сбережения: план и факт», «Траты по категориям» (the ring and the categories, each with its
 * month on average and overspends), «Импульсивные покупки». In the budget's currency or the system one.
 */
export default function YearStatsView({ range }: { range: DayRange }) {
  const year = Number(range.from.slice(0, 4));
  const cur = useReportCurrency(String(year), yearBudget);
  const { report: r, failed, load } = useYearReport(cur.shown ? year : null, cur.shown ?? undefined);
  const data = usePeriodData(range, cur.shown ?? cur.system);
  const [selected, setSelected] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const openTransactions = useOpenCategoryTransactions();
  const hidden = useHideAmounts();
  const { stats } = data;
  const segments = useMemo(() => (stats?.groups ?? []).flatMap((g) => g.categories)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color })), [stats]);
  if (!r || !stats || !cur.shown || r.currency !== cur.shown) return <Loading failed={failed || data.failed} onRetry={() => { load(); data.load(); }} />;
  const v = periodView({ ...data, stats, range, today: dayKeyOf(new Date()) });
  const money = (m: number) => formatWithCurrency(Math.round(m), r.currency);
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);
  // the year's purchases with no answer to "Обдуманная" / "Импульсивная", on the operations page
  const markImpulse = () => navigateWhenReady({ name: 'Main', params: { screen: 'Transactions', params: {
    unanswered: true, range: { from: `${year}-01-01`, to: `${year}-12-31` }, nonce: Date.now(), from: 'Stats' } } } as never);
  return (
    <StickyScrollView style={styles.screen} contentContainerStyle={styles.content} testID="year-stats">
      {cur.budget ? <CurrencyChoice budget={cur.budget} system={cur.system} value={cur.shown} onChange={cur.pick} /> : null}
      {r.count ? <YearNumbers r={r} page /> : null}
      {r.count ? <View><YearBars r={r} onMonth={openMonthReportPage} page table={<YearTable r={r} onMonth={openMonthReportPage} page />} /></View> : null}
      {r.savings || r.fundsNow.length ? <YearSavings r={r} page /> : null}
      {yearSpending({
        v, r, segments, picked, selected, onSelect: setSelected,
        h: { hidden, openInfo: setInfo, openTransactions: (id) => openTransactions(id, range) },
        onRefunds: () => openTransactions(null, range, ['refund']),
      })}
      {r.impulse ? <ImpulseBlock m={{ ...r.impulse, categories: [] }} money={money} onMark={markImpulse} page /> : null}
      <InfoSheet v={v} info={info} onClose={() => setInfo(null)} />
    </StickyScrollView>
  );
}
