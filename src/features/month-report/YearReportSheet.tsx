import React from 'react';
import { Text, View } from 'react-native';
import { navigateWhenReady } from '@/shared/navigation/navigation';
import { openReport } from '@/shared/navigation/reports';
import Loading from '@/shared/ui/Loading';
import StoryPager from '@/shared/ui/StoryPager';
import { useYearReport } from './model/useYearReport';
import ImpulseBlock from './ui/ImpulseBlock';
import { styles } from './ui/styles';
import YearBars from './ui/year/YearBars';
import YearNumbers from './ui/year/YearNumbers';
import YearSavings from './ui/year/YearSavings';
import YearTable from './ui/year/YearTable';
import YearWhere from './ui/year/YearWhere';
import { formatWithCurrency } from '@/shared/lib/money';

/**
 * «Итоги 2026» as stories: in numbers, by months (the bars), month by month (the table), the savings, where it went,
 * the impulsive purchases — one without data left out. A month — its report over them.
 */
export default function YearReportSheet({ year, onClose }: { year: number | null; onClose: () => void }) {
  const { report: r, failed, load } = useYearReport(year);
  // the year's purchases with no answer to "Обдуманная" / "Импульсивная", on the operations page
  const markImpulse = () => {
    if (year === null) return;
    onClose();
    navigateWhenReady({ name: 'Main', params: { screen: 'Transactions', params: {
      unanswered: true, range: { from: `${year}-01-01`, to: `${year}-12-31` }, nonce: Date.now(), from: 'Stats' } } } as never);
  };
  const money = (v: number) => formatWithCurrency(Math.round(v), r?.currency ?? 'GEL');
  const pages = !r ? [] : r.count === 0 ? [<Text key="none" style={styles.hint}>{`Данных за ${r.year} пока нет.`}</Text>] : [
    <YearNumbers key="numbers" r={r} />,
    <YearBars key="bars" r={r} onMonth={openReport} />,
    <YearTable key="table" r={r} onMonth={openReport} />,
    ...(r.savings || r.fundsNow.length ? [<YearSavings key="savings" r={r} />] : []),
    ...(r.top.length ? [<YearWhere key="where" r={r} />] : []),
    ...(r.impulse ? [<View key="impulse"><ImpulseBlock m={{ ...r.impulse, categories: [] }} money={money} onMark={markImpulse} /></View>] : []),
  ];
  return (
    <StoryPager
      visible={year !== null} onClose={onClose} title={year !== null ? `Итоги ${year}` : ''} pages={pages}
      placeholder={!r ? <Loading inline style={styles.loading} failed={failed} onRetry={load} /> : undefined}
    />
  );
}

