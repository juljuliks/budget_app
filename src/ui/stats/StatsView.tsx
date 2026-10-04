import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useOpenCategoryTransactions } from '../../navigation';
import { categoryLabel } from '../../db/categories';
import { Currency } from '../../db/fx';
import { CategoryStat, currentYm, monthStats, MonthStats, StatGroup, ymOf } from '../../db/plans';
import { dayKeyOf, daysInMonth, monthDays } from '../dateRange';
import { loadNorms, Norms, Pace, paceOf } from './norms';
import { onTransactionsChanged } from '../../events';
import Donut, { DonutSegment } from '../Donut';
import Meter from '../Meter';
import { currencySymbol, formatMoneyWithCurrency, formatShort, formatWithCurrency } from '../money';
import { NO_RATE, PER_PERIOD } from '../strings';
import { colors } from '../theme';
import PlanAmountModal, { PlanAmountTarget } from './PlanAmountModal';

/**
 * Donut: one segment per category with spending, in section order, so a type's categories sit next to
 * each other in their palette's shades (src/colors.ts).
 */
function donutSegments(groups: StatGroup[]): DonutSegment[] {
  return groups.flatMap((g) => g.categories)
    .filter((c) => c.spent_minor > 0)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color }));
}

export default function StatsView({ year, month, currency }: { year: number; month: number; currency: Currency }) {
  const [stats, setStats] = useState<MonthStats | null>(null);
  // "＋ В план" on a category without a plan amount
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  // the donut segment tapped: its category's spending and share in the hole
  const [selected, setSelected] = useState<string | null>(null);
  // the current month: each flexible category's norm window around today (today / this week / these 2 weeks)
  const [today, setToday] = useState<Norms | null>(null);

  const load = useCallback(() => {
    monthStats(year, month, currency).then(setStats).catch((e) => console.error('load stats failed', e));
    if (ymOf(year, month) === currentYm()) {
      const d = dayKeyOf(new Date());
      loadNorms({ from: d, to: d }, currency).then(setToday).catch((e) => console.error('load norms failed', e));
    } else setToday(null);
  }, [year, month, currency]);

  useFocusEffect(load);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const segments = useMemo(() => (stats ? donutSegments(stats.groups) : []), [stats]);

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;

  const remaining = stats.planned_minor - stats.spent_minor;
  // the current month: a tick on each flexible category's bar where an even pace would be today
  const ym = ymOf(year, month);
  const evenPace = ym === currentYm() ? new Date().getDate() / daysInMonth(ym) : undefined;
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={stats.currency} />
        </Donut>
      </View>

      {stats.planned_minor > 0 ? (
        <View style={styles.summary}>
          <SummaryItem label="План" value={formatWithCurrency(stats.planned_minor, stats.currency)} />
          <SummaryItem
            label={remaining >= 0 ? 'Осталось' : 'Перерасход'}
            value={formatWithCurrency(Math.abs(remaining), stats.currency)}
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
                {g.planned_minor ? formatShort(g.spent_minor) : formatWithCurrency(g.spent_minor, stats.currency)}
                {g.planned_minor ? <Text style={styles.rowLimit}> / {formatWithCurrency(g.planned_minor, stats.currency)}</Text> : null}
              </Text>
            </View>
            {g.categories.map((c) => (
              <CategoryRow
                key={String(c.category_id)}
                stat={c}
                currency={stats.currency}
                evenPace={evenPace}
                dim={daysInMonth(ym)}
                ym={ym}
                now={c.category_id === null ? undefined : today?.byCategory.get(c.category_id)}
                monthToDate={c.category_id === null ? 0 : today?.monthToDate.get(c.category_id) ?? 0}
                onAddToPlan={c.category_id !== null && c.limit_minor === null && !c.deleted
                  ? () => setPlanTarget({ category_id: c.category_id!, label: categoryLabel(c), limit_minor: 0, currency })
                  : undefined}
              />
            ))}
          </View>
        ))
      )}

      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          {NO_RATE} {stats.other_currencies.map((o) => formatMoneyWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}

      <PlanAmountModal ym={ymOf(year, month)} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={load} />
    </ScrollView>
  );
}

/** The hole: the month's total, or the tapped category's spending and its share of the total. */
export function DonutCenter({ total, picked, currency }: { total: number; picked?: { name: string; emoji: string | null; spent_minor: number }; currency: Currency }) {
  if (!picked) {
    return (
      <>
        <Text style={styles.caption}>Потрачено</Text>
        <Text style={styles.hero}>{formatShort(total)}</Text>
        <Text style={styles.caption}>{currencySymbol(currency)}</Text>
      </>
    );
  }
  const share = total > 0 ? Math.round((picked.spent_minor / total) * 100) : 0;
  return (
    <>
      <Text style={styles.pickedName} numberOfLines={2}>{`${picked.emoji || ''} ${picked.name}`.trim()}</Text>
      <Text style={styles.pickedAmount}>{formatWithCurrency(picked.spent_minor, currency)}</Text>
      <Text style={styles.caption}>{share === 0 && picked.spent_minor > 0 ? '<1' : share}% всех трат</Text>
    </>
  );
}

/** " (50%)" after "spent / limit" of a flexible category; nothing while nothing is spent. */
function planShare(spent: number, limit: number): string {
  if (spent <= 0 || limit <= 0) return '';
  const p = Math.round((spent / limit) * 100);
  return ` (${p === 0 ? '<1' : p}%)`;
}

function SummaryItem({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.summaryValue, danger && styles.dangerText]}>{danger ? '⚠ ' : ''}{value}</Text>
    </View>
  );
}

const RHYTHM_DAYS = { day: 1, week: 7, '2weeks': 14 } as const;
const RHYTHM_NOW = { day: 'Сегодня', week: 'На этой неделе', '2weeks': 'За эти 2 недели' } as const;
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

type NowNorm = Norms['byCategory'] extends Map<number, infer V> ? V : never;

function CategoryRow({ stat, currency, evenPace, dim, ym, now, monthToDate, onAddToPlan }: {
  stat: CategoryStat; currency: Currency; evenPace?: number; dim: number;
  /** the month shown: its operations open for this period */
  ym: string;
  /** the current month only: the norm window around today */
  now?: NowNorm; monthToDate: number;
  onAddToPlan?: () => void;
}) {
  const openTransactions = useOpenCategoryTransactions();
  const { spent_minor: spent, limit_minor: limit } = stat;
  const ratio = limit ? spent / limit : 0;
  // fixed payment (rent, subscription): any spending this month means it's paid
  const fixed = stat.plan_kind === 'fixed';
  const paid = spent > 0;
  const rhythm = !fixed && stat.plan_norm && stat.plan_norm !== 'month' ? stat.plan_norm : null;

  return (
    <TouchableOpacity style={styles.row} onPress={() => openTransactions(stat.category_id, monthDays(ym))} accessibilityHint="Показать операции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: stat.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${stat.emoji || ''} ${stat.name}`.trim()}</Text>
        {/* an obligatory payment: paid this month (any spending) — a green tick, otherwise a grey circle */}
        {limit && fixed ? (
          <Text style={[styles.paidMark, paid ? styles.paidOn : styles.paidOff]} accessibilityLabel={paid ? 'Оплачено' : 'Не оплачено'}>
            {paid ? '✓' : '○'}
          </Text>
        ) : null}
        {onAddToPlan ? (
          <TouchableOpacity style={styles.addToPlan} onPress={onAddToPlan} hitSlop={8} accessibilityLabel={`Добавить в план: ${stat.name}`}>
            <Text style={styles.addToPlanText}>＋ В план</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.rowAmount}>
          {limit ? formatShort(spent) : formatWithCurrency(spent, currency)}{limit ? <Text style={styles.rowLimit}> / {formatWithCurrency(limit, currency)}{fixed ? '' : planShare(spent, limit)}</Text> : null}
        </Text>
      </View>
      {limit && !fixed ? (
        <>
          <Meter ratio={ratio} height={8} marker={stat.plan_norm === 'month' ? undefined : evenPace} />
          <Text style={[styles.rowStatus, ratio > 1 && styles.dangerText]}>
            {ratio > 1 ? `⚠ перерасход ${formatWithCurrency(spent - limit, currency)}` : `осталось ${formatWithCurrency(limit - spent, currency)}`}
            {/* a category spent daily / weekly: its limit per that period, "лимит ≈ 113 ₾ в неделю" */}
            {/* the current month: this window's limit, rebalanced on what's left of the month; a past one: the plan's share */}
            {rhythm ? <Text style={styles.rowStatusMuted}> · лимит ≈ {formatWithCurrency(Math.round(now && now.rhythm === rhythm ? now.windowNorm : (limit / dim) * RHYTHM_DAYS[rhythm]), currency)} {PER_PERIOD[rhythm]}</Text> : null}
          </Text>
          {rhythm && now && now.rhythm === rhythm ? (() => {
            // the current month: what's left in today's / this week's window, colored by pace
            const left = Math.round(now.windowNorm) - now.windowSpent;
            const p: Pace = paceOf(now.windowSpent, now.windowNorm, monthToDate, now.monthLimit);
            return (
              <Text style={[styles.rowStatus, styles.paceLine, p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.dangerText]}>
                {RHYTHM_NOW[rhythm]} {left < 0 ? `перерасход ${formatWithCurrency(-left, currency)}` : `осталось ${formatWithCurrency(left, currency)}`}
                {left >= 0 && rhythm !== 'day' ? <Text style={styles.rowStatusMuted}> · до {WEEKDAYS[new Date(`${now.window.to}T12:00:00`).getDay()]}</Text> : null}
              </Text>
            );
          })() : null}
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
  pickedName: { fontSize: 15, color: colors.text, textAlign: 'center', maxWidth: 150 },
  pickedAmount: { fontSize: 24, fontWeight: '700', color: colors.text, marginVertical: 2 },
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
  rowStatusMuted: { color: colors.muted },
  paceLine: { fontWeight: '600' },
  paceOk: { color: colors.income },
  paceAhead: { color: colors.warn },
  // under the amount, on the right
  paidMark: { fontSize: 16, fontWeight: '700', marginLeft: 6 },
  paidOn: { color: colors.income },
  paidOff: { color: colors.muted },
});
