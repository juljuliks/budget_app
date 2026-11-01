import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import { Currency } from '@/db/fx';
import { CategoryStat, monthStats, MonthStats, parseYm } from '@/db/plans';
import { splitUnplanned, unplannedShare } from '@/entities/plan';
import Loading from '@/shared/ui/Loading';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import { formatMoneyWithCurrency, formatWithCurrency } from '@/shared/lib/money';
import { monthDays } from '@/shared/lib/dateRange';
import { NO_RATE } from '@/shared/lib/strings';
import DetailGroup from './DetailGroup';
import FundRows from './FundRows';
import SavingsSection from './SavingsSection';
import { styles } from './styles';
import type { MonthSavings } from '../model/savings';

/**
 * The opened month, grouped as its stats: the plan's categories by section against their amounts, "Вне плана" (the
 * others and the uncategorized) against the budget's share for them, the funds, then its savings.
 */
export default function MonthDetails({ ym, currency, savings }: { ym: string; currency: Currency; savings: MonthSavings | null }) {
  // tap a category: its transactions (category filter), same as on the stats screen
  const openTransactions = useOpenCategoryTransactions();
  const [data, setData] = useState<{ stats: MonthStats; share: number } | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load month');
  const load = useCallback(() => {
    const keep = latest();
    started();
    const { year, month } = parseYm(ym);
    Promise.all([monthStats(year, month, currency), unplannedShare(ym, currency)])
      .then(keep(([stats, share]) => setData({ stats, share }))).catch(keep(fail));
  }, [ym, currency, latest, started, fail]);
  useEffect(load, [load]);

  const money = (minor: number) => formatWithCurrency(minor, currency);
  if (!data) return <Loading inline failed={failed} onRetry={load} />;
  const { stats, share } = data;
  if (stats.categories.length === 0 && stats.funds.length === 0) return <Text style={styles.hint}>Нет трат и плана.</Text>;
  const split = splitUnplanned(stats.groups, (c) => c.limit_minor !== null);
  const open = (c: CategoryStat) => openTransactions(c.category_id, monthDays(ym));

  return (
    <View style={styles.details}>
      <View style={styles.detailRow}>
        <Text style={[styles.detailName, styles.detailHead]}>Категория</Text>
        <Text style={[styles.detailNum, styles.detailHead]}>План</Text>
        <Text style={[styles.detailNum, styles.detailHead]}>Потрачено</Text>
      </View>
      {split.groups.map((g) => (
        <DetailGroup key={`${g.type_id}-${g.title}`} title={g.title} planned={g.planned_minor} spent={g.spent_minor} categories={g.categories} money={money} onOpen={open} />
      ))}
      {split.unplanned.length || share > 0
        ? <DetailGroup title="Вне плана" planned={share} spent={split.spent} categories={split.unplanned} money={money} onOpen={open} />
        : null}
      {stats.funds.length ? <FundRows funds={stats.funds} money={money} /> : null}
      {savings?.section ? <SavingsSection s={savings} money={money} /> : null}
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.note}>
          {NO_RATE} {stats.other_currencies.map((o) => formatMoneyWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}
    </View>
  );
}
