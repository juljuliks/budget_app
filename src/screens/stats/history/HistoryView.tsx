import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Currency } from '@/db/fx';
import { HistoryMonth, monthToClose, planHistory } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import Loading from '@/shared/ui/Loading';
import LinkCard from '@/shared/ui/LinkCard';
import { StatsIcon } from '@/shared/ui/icons';
import { openYearReport } from '@/shared/navigation/sheets';
import { colors } from '@/shared/theme/theme';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import MonthRow from './parts/MonthRow';
import { styles } from './parts/styles';

/**
 * Planned vs actually spent and what went to savings, per month and (expanded) per category, in `currency`; on top —
 * «Итоги 2026 ›», the year's stories.
 */
export default function HistoryView({ currency }: { currency: Currency }) {
  const [months, setMonths] = useState<HistoryMonth[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
  // «Итоги 2026 ›»: each year of the history, the newest first
  const years = [...new Set(months.map((m) => Number(m.ym.slice(0, 4))))];

  return (
    <FlatList
      data={months}
      keyExtractor={(m) => m.ym}
      contentContainerStyle={styles.content}
      ListHeaderComponent={years.length ? (
        <>
          {years.map((y) => (
            <LinkCard key={y} icon={<StatsIcon color={colors.accent} size={20} />} label={`Итоги ${y}`} onPress={() => openYearReport(y)} style={styles.yearLink} />
          ))}
        </>
      ) : null}
      ListEmptyComponent={<Text style={styles.hint}>Истории пока нет.</Text>}
      renderItem={({ item }) => (
        <MonthRow
          month={item}
          currency={currency}
          expanded={expanded === item.ym}
          onToggle={() => setExpanded((cur) => (cur === item.ym ? null : item.ym))}
        />
      )}
    />
  );
}
