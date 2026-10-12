import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Currency } from '@/db/fx';
import { HistoryMonth, planHistory } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import Loading from '@/shared/ui/Loading';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import MonthRow from './parts/MonthRow';
import { styles } from './parts/styles';

/** Planned vs actually spent and what went to savings, per month and (expanded) per category, in `currency`. */
export default function HistoryView({ currency }: { currency: Currency }) {
  const [months, setMonths] = useState<HistoryMonth[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load history');
  const load = useCallback(() => {
    // answers of a previous currency (switched quickly) are dropped
    const keep = latest();
    started();
    planHistory(undefined, currency).then(keep(setMonths)).catch(keep(fail));
  }, [currency, latest, started, fail]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!months) return <Loading failed={failed} onRetry={load} />;

  return (
    <FlatList
      data={months}
      keyExtractor={(m) => m.ym}
      contentContainerStyle={styles.content}
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
