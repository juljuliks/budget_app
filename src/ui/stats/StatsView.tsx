import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../../navigation';
import { BUDGET_CURRENCY, CategoryStat, monthStats, MonthStats } from '../../db/plans';
import { onTransactionsChanged } from '../../events';
import Donut, { DonutSegment } from '../Donut';
import { formatMoney } from '../money';
import { chart, colors, seriesColor } from '../theme';

/** Donut: the top-colored categories (≤5) + one folded "other" segment, so ≤6 segments. */
function donutSegments(cats: CategoryStat[]): DonutSegment[] {
  const segments: DonutSegment[] = [];
  let other = 0;
  for (const c of cats) {
    if (c.spent_minor <= 0) continue;
    if (c.category_id !== null && c.color_rank < chart.series.length) {
      segments.push({ key: String(c.category_id), value: c.spent_minor, color: seriesColor(c.color_rank) });
    } else {
      other += c.spent_minor;
    }
  }
  if (other > 0) segments.push({ key: 'other', value: other, color: chart.other });
  return segments;
}

export default function StatsView({ year, month }: { year: number; month: number }) {
  const [stats, setStats] = useState<MonthStats | null>(null);

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
          <Text style={styles.hero}>{formatMoney(stats.spent_minor, { compact: true })}</Text>
          <Text style={styles.caption}>{BUDGET_CURRENCY}</Text>
        </Donut>
      </View>

      {stats.planned_minor > 0 ? (
        <View style={styles.summary}>
          <SummaryItem label="План" value={formatMoney(stats.planned_minor, { compact: true })} />
          <SummaryItem
            label={remaining >= 0 ? 'Осталось' : 'Сверх плана'}
            value={formatMoney(Math.abs(remaining), { compact: true })}
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
                {formatMoney(g.spent_minor, { compact: true })}
                {g.planned_minor ? <Text style={styles.rowLimit}> / {formatMoney(g.planned_minor, { compact: true })}</Text> : null}
              </Text>
            </View>
            {g.categories.map((c) => <CategoryRow key={String(c.category_id)} stat={c} />)}
          </View>
        ))
      )}

      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          Не учтено (другая валюта): {stats.other_currencies.map((o) => `${formatMoney(o.spent_minor)} ${o.currency}`).join(', ')}
        </Text>
      ) : null}
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

function CategoryRow({ stat }: { stat: CategoryStat }) {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { spent_minor: spent, limit_minor: limit } = stat;
  const dot = stat.category_id !== null && stat.color_rank < chart.series.length ? seriesColor(stat.color_rank) : chart.other;
  const ratio = limit ? spent / limit : 0;
  const fill = ratio > 1 ? chart.critical : ratio >= 0.8 ? chart.warning : chart.meterFill;

  // tap: the category's transactions (category filter)
  const open = () => navigation.navigate('Transactions', { category: stat.category_id ?? 'none', nonce: Date.now(), from: 'Stats' });

  return (
    <TouchableOpacity style={styles.row} onPress={open} accessibilityHint="Показать транзакции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${stat.emoji || ''} ${stat.name}`.trim()}</Text>
        <Text style={styles.rowAmount}>
          {formatMoney(spent, { compact: true })}{limit ? <Text style={styles.rowLimit}> / {formatMoney(limit, { compact: true })}</Text> : null}
        </Text>
      </View>
      {limit ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(Math.max(ratio, 0), 1) * 100}%`, backgroundColor: fill }]} />
          </View>
          <Text style={[styles.rowStatus, ratio > 1 && styles.dangerText]}>
            {ratio > 1
              ? `⚠ превышено на ${formatMoney(spent - limit, { compact: true })}`
              : `осталось ${formatMoney(limit - spent, { compact: true })}`}
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
  rowName: { flex: 1, fontSize: 15, color: colors.text },
  rowAmount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  rowLimit: { color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: chart.meterTrack, marginTop: 8, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  rowStatus: { fontSize: 13, color: colors.muted, marginTop: 4 },
});
