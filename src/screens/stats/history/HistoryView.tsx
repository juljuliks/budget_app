import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Currency } from '@/db/fx';
import { currentYm, HistoryMonth, monthToClose, planHistory } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import Loading from '@/shared/ui/Loading';
import LinkCard from '@/shared/ui/LinkCard';
import { StatsIcon } from '@/shared/ui/icons';
import { openYear } from '@/shared/navigation/reports';
import { colors } from '@/shared/theme/theme';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import PeriodNav from '../parts/PeriodNav';
import { historyYears, yearMonths } from './model/yearMonths';
import EmptyMonth from './parts/EmptyMonth';
import MonthRow from './parts/MonthRow';
import { styles } from './parts/styles';

/**
 * Planned vs actually spent and what went to savings, per month and (expanded) per category, in `currency`: a year's
 * 12 months (the coming ones «впереди», the ones before the data «нет операций»), the arrows — the years before; on
 * top — «Итоги 2026 — статистика за год ›» (its stories while fresh).
 */
export default function HistoryView({ currency }: { currency: Currency }) {
  const [months, setMonths] = useState<HistoryMonth[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // the year shown (none — the current one)
  const [year, setYear] = useState<number | null>(null);

  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load history');
  const load = useCallback(() => {
    // answers of a previous currency (switched quickly) are dropped
    const keep = latest();
    started();
    // the months with nothing to ask are closed first: no "Итоги не подведены" on them
    monthToClose().then(() => planHistory(undefined, currency)).then(keep(setMonths)).catch(keep(fail));
  }, [currency, latest, started, fail]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!months) return <Loading failed={failed} onRetry={load} />;
  const nowYm = currentYm();
  const years = historyYears(months, Number(nowYm.slice(0, 4)));
  const shown = year ?? years[0];
  const rows = yearMonths(months, shown, nowYm);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.ym}
      contentContainerStyle={styles.content}
      ListHeaderComponent={(
        <>
          {/* the year's months; the arrows — the years before */}
          <PeriodNav
            unit="год" label={String(shown)}
            onPrev={() => setYear(shown - 1)} prevDisabled={shown <= years[years.length - 1]}
            onNext={() => setYear(shown + 1)} nextDisabled={shown >= years[0]}
          />
          <LinkCard icon={<StatsIcon color={colors.accent} size={20} />} label={`Итоги ${shown} — статистика за год`} onPress={() => openYear(shown)} style={styles.yearLink} />
        </>
      )}
      renderItem={({ item }) => (item.month ? (
        <MonthRow
          month={item.month}
          currency={currency}
          expanded={expanded === item.ym}
          onToggle={() => setExpanded((cur) => (cur === item.ym ? null : item.ym))}
        />
      ) : <EmptyMonth ym={item.ym} future={item.state === 'future'} />)}
    />
  );
}
