import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import { Currency } from '@/db/fx';
import { monthStats, MonthStats, parseYm } from '@/db/plans';
import Loading from '@/shared/ui/Loading';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import { formatMoneyWithCurrency, formatWithCurrency } from '@/shared/lib/money';
import { monthDays } from '@/shared/lib/dateRange';
import { NO_RATE } from '@/shared/lib/strings';
import SavingsSection from './SavingsSection';
import { styles } from './styles';
import type { MonthSavings } from '../model/savings';

/** The opened month: its sections and categories against the plan, then its savings. */
export default function MonthDetails({ ym, currency, savings }: { ym: string; currency: Currency; savings: MonthSavings | null }) {
  // tap a category: its transactions (category filter), same as on the stats screen
  const openTransactions = useOpenCategoryTransactions();
  const [stats, setStats] = useState<MonthStats | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load month');
  const load = useCallback(() => {
    const keep = latest();
    started();
    const { year, month } = parseYm(ym);
    monthStats(year, month, currency).then(keep(setStats)).catch(keep(fail));
  }, [ym, currency, latest, started, fail]);
  useEffect(load, [load]);

  const money = (minor: number) => formatWithCurrency(minor, currency);
  if (!stats) return <Loading inline failed={failed} onRetry={load} />;
  if (stats.categories.length === 0) return <Text style={styles.hint}>Нет трат и плана.</Text>;

  return (
    <View style={styles.details}>
      <View style={styles.detailRow}>
        <Text style={[styles.detailName, styles.detailHead]}>Категория</Text>
        <Text style={[styles.detailNum, styles.detailHead]}>План</Text>
        <Text style={[styles.detailNum, styles.detailHead]}>Потрачено</Text>
      </View>
      {stats.groups.map((g) => (
        <View key={`${g.type_id}-${g.title}`}>
          <View style={[styles.detailRow, styles.groupRow]}>
            <Text style={[styles.detailName, styles.groupTitle]} numberOfLines={1}>{g.title}</Text>
            <Text style={[styles.detailNum, styles.groupTitle]}>{g.planned_minor ? money(g.planned_minor) : '—'}</Text>
            <Text style={[styles.detailNum, styles.groupTitle]}>{money(g.spent_minor)}</Text>
          </View>
          {g.categories.map((c) => {
            const over = c.limit_minor !== null && c.spent_minor > c.limit_minor;
            return (
              <TouchableOpacity
                key={String(c.category_id)}
                style={styles.detailRow}
                onPress={() => openTransactions(c.category_id, monthDays(ym))}
              >
                <Text style={styles.detailName} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
                <Text style={styles.detailNum}>{c.limit_minor ? money(c.limit_minor) : '—'}</Text>
                <Text style={[styles.detailNum, over && styles.danger]}>
                  {over ? '⚠ ' : ''}{money(c.spent_minor)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {savings?.section ? <SavingsSection s={savings} money={money} /> : null}
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.note}>
          {NO_RATE} {stats.other_currencies.map((o) => formatMoneyWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}
    </View>
  );
}
