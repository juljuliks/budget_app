import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { monthStats, parseYm, periodStats, PeriodStats } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { onTransactionsChanged } from '../../events';
import Donut from '../Donut';
import Meter from '../Meter';
import { formatShort } from '../money';
import { colors } from '../theme';
import { DonutCenter } from './StatsView';

type Props = {
  from: number;
  to: number;
  emptyText?: string;
  /** a day / a week: spending is also shown as a share of this month's plan (its total and each category's) */
  planYm?: string;
};

const MONTHS_IN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** "12%", "<1%" for a tiny non-zero share. */
function pct(part: number, whole: number): string {
  const p = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return p === 0 && part > 0 ? '<1%' : `${p}%`;
}

/** Spending of any period [from, to) by category, with a donut (one day, a week, a year, a chosen range). */
export default function PeriodStatsView({ from, to, emptyText = 'За этот период трат нет.', planYm }: Props) {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // the app's currency (Настройки → Валюта)
  const currency = useDisplayCurrency();

  // the month's plan in the same currency: its total and each category's amount
  const [plan, setPlan] = useState<{ total: number; byCategory: Map<number | null, number> } | null>(null);

  const load = useCallback(() => {
    periodStats(from, to, currency).then(setStats).catch((e) => console.error('load period stats failed', e));
    if (!planYm) { setPlan(null); return; }
    const { year, month } = parseYm(planYm);
    monthStats(year, month, currency).then((m) => setPlan({
      total: m.planned_minor,
      byCategory: new Map(m.categories.filter((c) => c.limit_minor).map((c) => [c.category_id, c.limit_minor!])),
    })).catch((e) => console.error('load month plan failed', e));
  }, [from, to, currency, planYm]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const segments = useMemo(() => (stats?.groups ?? []).flatMap((g) => g.categories)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color })), [stats]);

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);
  const shareLabel = (minor: number) => pct(minor, stats.spent_minor);
  const monthName = planYm ? MONTHS_IN[parseYm(planYm).month] : '';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={stats.currency} />
        </Donut>
      </View>
      {plan && plan.total > 0 && stats.spent_minor > 0 ? (
        <Text style={styles.planShare}>
          {pct(stats.spent_minor, plan.total)} плана на {monthName} ({formatShort(plan.total)} {stats.currency})
        </Text>
      ) : null}
      {stats.categories.length === 0 ? <Text style={styles.hint}>{emptyText}</Text> : null}
      {stats.groups.map((g) => (
        <View key={`${g.type_id}-${g.title}`} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <Text style={styles.groupTotal}>{formatShort(g.spent_minor)}</Text>
          </View>
          {g.categories.map((c) => (
            <View key={String(c.category_id)} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <Text style={styles.name} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
                <Text style={styles.amount}>{formatShort(c.spent_minor)} {stats.currency}</Text>
              </View>
              {/* no plan outside a month: the bar is the category's share of all spending */}
              <Meter ratio={stats.spent_minor > 0 ? c.spent_minor / stats.spent_minor : 0} height={8} color={c.color} />
              <Text style={styles.share}>
                {shareLabel(c.spent_minor)} всех трат за период
                {plan?.byCategory.get(c.category_id) ? ` · ${pct(c.spent_minor, plan.byCategory.get(c.category_id)!)} плана категории` : ''}
              </Text>
            </View>
          ))}
        </View>
      ))}
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          Не учтено, нет курса (нужен интернет): {stats.other_currencies.map((o) => `${formatShort(o.spent_minor)} ${o.currency}`).join(', ')}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: 8 },
  planShare: { fontSize: 14, color: colors.text, textAlign: 'center', marginBottom: 8 },
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
  name: { flex: 1, fontSize: 15, color: colors.text },
  share: { fontSize: 13, color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
});
