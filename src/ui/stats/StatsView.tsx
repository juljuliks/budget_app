import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useOpenCategoryTransactions } from '../../navigation';
import { categoryLabel } from '../../db/categories';
import { BUDGET_CURRENCY, CategoryStat, monthStats, MonthStats, ymOf } from '../../db/plans';
import { onTransactionsChanged } from '../../events';
import Donut, { DonutSegment } from '../Donut';
import Meter from '../Meter';
import { formatMoney, formatShort } from '../money';
import { chart, colors, seriesColor } from '../theme';
import PlanAmountModal, { PlanAmountTarget } from './PlanAmountModal';

/** Its own color for the top categories by all-time spend; the rest (and uncategorized) share "other". */
function hasOwnColor(c: CategoryStat): boolean {
  return c.category_id !== null && c.color_rank < chart.series.length;
}

/** Donut: the top-colored categories (≤5) + one folded "other" segment, so ≤6 segments. */
function donutSegments(cats: CategoryStat[]): DonutSegment[] {
  const segments: DonutSegment[] = [];
  let other = 0;
  for (const c of cats) {
    if (c.spent_minor <= 0) continue;
    if (hasOwnColor(c)) segments.push({ key: String(c.category_id), value: c.spent_minor, color: seriesColor(c.color_rank) });
    else other += c.spent_minor;
  }
  if (other > 0) segments.push({ key: 'other', value: other, color: chart.other });
  return segments;
}

export default function StatsView({ year, month }: { year: number; month: number }) {
  const [stats, setStats] = useState<MonthStats | null>(null);
  // "＋ В план" on a category without a plan amount
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);

  const load = useCallback(() => {
    monthStats(year, month).then(setStats).catch((e) => console.error('load stats failed', e));
  }, [year, month]);

  useFocusEffect(load);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const segments = useMemo(() => (stats ? donutSegments(stats.categories) : []), [stats]);

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;

  const remaining = stats.planned_minor - stats.spent_minor;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments}>
          <Text style={styles.caption}>Потрачено</Text>
          <Text style={styles.hero}>{formatShort(stats.spent_minor)}</Text>
          <Text style={styles.caption}>{BUDGET_CURRENCY}</Text>
        </Donut>
      </View>

      {stats.planned_minor > 0 ? (
        <View style={styles.summary}>
          <SummaryItem label="План" value={formatShort(stats.planned_minor)} />
          <SummaryItem
            label={remaining >= 0 ? 'Осталось' : 'Сверх плана'}
            value={formatShort(Math.abs(remaining))}
            danger={remaining < 0}
          />
        </View>
      ) : (
        <Text style={styles.hint}>Составьте план на месяц во вкладке «План», чтобы видеть остаток по категориям.</Text>
      )}

      {stats.categories.length === 0 ? (
        <Text style={styles.hint}>В этом месяце трат нет.</Text>
      ) : (
        stats.groups.map((g) => (
          <View key={`${g.type_id}-${g.title}`} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              <Text style={styles.groupTotal}>
                {formatShort(g.spent_minor)}
                {g.planned_minor ? <Text style={styles.rowLimit}> / {formatShort(g.planned_minor)}</Text> : null}
              </Text>
            </View>
            {g.categories.map((c) => (
              <CategoryRow
                key={String(c.category_id)}
                stat={c}
                onAddToPlan={c.category_id !== null && c.limit_minor === null && !c.deleted
                  ? () => setPlanTarget({ category_id: c.category_id!, label: categoryLabel(c), limit_minor: 0 })
                  : undefined}
              />
            ))}
          </View>
        ))
      )}

      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          Не учтено (другая валюта): {stats.other_currencies.map((o) => `${formatMoney(o.spent_minor)} ${o.currency}`).join(', ')}
        </Text>
      ) : null}

      <PlanAmountModal ym={ymOf(year, month)} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={load} />
    </ScrollView>
  );
}

function SummaryItem({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.summaryValue, danger && styles.dangerText]}>{danger ? '⚠ ' : ''}{value}</Text>
    </View>
  );
}

function CategoryRow({ stat, onAddToPlan }: { stat: CategoryStat; onAddToPlan?: () => void }) {
  const openTransactions = useOpenCategoryTransactions();
  const { spent_minor: spent, limit_minor: limit } = stat;
  const dot = hasOwnColor(stat) ? seriesColor(stat.color_rank) : chart.other;
  const ratio = limit ? spent / limit : 0;

  return (
    <TouchableOpacity style={styles.row} onPress={() => openTransactions(stat.category_id)} accessibilityHint="Показать транзакции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${stat.emoji || ''} ${stat.name}`.trim()}</Text>
        {onAddToPlan ? (
          <TouchableOpacity style={styles.addToPlan} onPress={onAddToPlan} hitSlop={8} accessibilityLabel={`Добавить в план: ${stat.name}`}>
            <Text style={styles.addToPlanText}>＋ В план</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.rowAmount}>
          {formatShort(spent)}{limit ? <Text style={styles.rowLimit}> / {formatShort(limit)}</Text> : null}
        </Text>
      </View>
      {limit ? (
        <>
          <Meter ratio={ratio} height={8} />
          <Text style={[styles.rowStatus, ratio > 1 && styles.dangerText]}>
            {ratio > 1 ? `⚠ превышено на ${formatShort(spent - limit)}` : `осталось ${formatShort(limit - spent)}`}
          </Text>
        </>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: 16 },
  caption: { fontSize: 13, color: colors.muted },
  hero: { fontSize: 34, fontWeight: '700', color: colors.text },
  summary: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 2 },
  dangerText: { color: colors.danger },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 16 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.border,
  },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  rowName: { flexShrink: 1, fontSize: 15, color: colors.text },
  addToPlan: {
    marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  addToPlanText: { fontSize: 12, color: colors.accent },
  rowAmount: { marginLeft: 'auto', paddingLeft: 8, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  rowLimit: { color: colors.muted },
  rowStatus: { fontSize: 13, color: colors.muted, marginTop: 4 },
});
