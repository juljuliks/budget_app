import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useOpenCategoryTransactions } from '../../navigation';
import { categoryLabel } from '../../db/categories';
import { Currency } from '../../db/fx';
import { CategoryStat, currentYm, monthStats, MonthStats, StatGroup, ymOf } from '../../db/plans';
import { dayKeyOf, daysInMonth, monthDays } from '../dateRange';
import { flatOf, limitChange, loadNorms, Norms, Pace, paceOf } from './norms';
import { onTransactionsChanged } from '../../events';
import Donut, { DonutSegment } from '../Donut';
import Masked, { MaskedTotal } from '../Masked';
import { useHideAmounts } from '../../hideAmounts';
import Meter from '../Meter';
import { formatMoneyWithCurrency, formatShort, formatWithCurrency } from '../money';
import { NO_RATE, PER_PERIOD } from '../strings';
import { chart, colors } from '../theme';
import PlanAmountModal, { PlanAmountTarget } from './PlanAmountModal';
import { useLatestRequest } from '../useLatestRequest';
import { formStyles } from '../formStyles';
import { FoldHeader, useFolded } from '../fold';
import { LimitsAccordion } from './SummaryTiles';
import { pct } from './summaryGroups';
import { MonthReportRow } from './MonthReport';
import { summaryGroups } from './summaryGroups';
import { splitUnplanned, unplannedShare } from './unplanned';

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
  // the month's share for spending outside the plan (0 without a budget)
  const [share, setShare] = useState(0);
  const hidden = useHideAmounts();
  // "＋ В план" on a category without a plan amount
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  // the donut segment tapped: its category's spending and share in the hole
  const [selected, setSelected] = useState<string | null>(null);
  // the current month: each flexible category's norm window around today (today / this week / these 2 weeks)
  const [today, setToday] = useState<Norms | null>(null);

  const latest = useLatestRequest();
  const load = useCallback(() => {
    // answers of a previous month (switched quickly) are dropped
    const keep = latest();
    monthStats(year, month, currency).then(keep(setStats)).catch((e) => console.error('load stats failed', e));
    unplannedShare(ymOf(year, month), currency).then(keep(setShare)).catch((e) => console.error('load unplanned share failed', e));
    if (ymOf(year, month) === currentYm()) {
      const d = dayKeyOf(new Date());
      loadNorms({ from: d, to: d }, currency).then(keep(setToday)).catch((e) => console.error('load norms failed', e));
    } else setToday(null);
  }, [year, month, currency, latest]);

  // on focus, and again whenever load changes while focused (useFocusEffect re-runs on a new callback): no extra useEffect
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const segments = useMemo(() => (stats ? donutSegments(stats.groups) : []), [stats]);
  // hooks before the loading return: their order must not change between renders
  const openTransactions = useOpenCategoryTransactions();
  // folded sections, remembered
  const fold = useFolded('stats-month');

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;

  // the categories without a plan and the uncategorized: one "Вне плана" section at the bottom, with the budget's share
  const split = splitUnplanned(stats.groups, (c) => c.limit_minor !== null);
  // the plan's categories and the share outside them: what's left of both (an overspend outside the plan too)
  const plannedAll = stats.planned_minor + share;
  const remaining = plannedAll - stats.spent_minor;
  // the current month: a tick on each flexible category's bar where an even pace would be today
  const ym = ymOf(year, month);
  const evenPace = ym === currentYm() ? new Date().getDate() / daysInMonth(ym) : undefined;
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);
  const todayKey = dayKeyOf(new Date());
  // 'outside' needs today's spending outside the limits: not a month figure, left out here
  const limitGroups = today ? summaryGroups(today, { from: todayKey, to: todayKey }, 0, todayKey).filter((g) => g.key !== 'outside') : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* a month that is over: its report on top */}
      {ym < currentYm() ? <View style={styles.report}><MonthReportRow ym={ym} /></View> : null}
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={stats.currency} />
        </Donut>
      </View>

      {plannedAll > 0 ? (
        <View style={styles.summary}>
          <SummaryItem label="План" value={formatWithCurrency(plannedAll, stats.currency)} />
          <SummaryItem
            label={remaining >= 0 ? 'Осталось' : 'Перерасход'}
            value={formatWithCurrency(Math.abs(remaining), stats.currency)}
            danger={remaining < 0}
          />
        </View>
      ) : (
        <Text style={styles.hint}>Составьте план на месяц во вкладке «План», чтобы видеть остаток по категориям.</Text>
      )}

      {/* the current month: the limits now (today, this week, the month), folded */}
      {limitGroups.length ? <LimitsAccordion key={ym} defaultOpen={false} foldKey="month" groups={limitGroups} money={(v) => formatWithCurrency(v, stats.currency)} /> : null}

      {stats.categories.length === 0 ? (
        <Text style={styles.hint}>В этом месяце трат нет.</Text>
      ) : (
        split.groups.map((g) => (
          <View key={`${g.type_id}-${g.title}`} style={styles.group}>
            <FoldHeader style={[formStyles.sectionHeader, styles.groupHeader]} folded={fold.is(g.title)} onToggle={() => fold.toggle(g.title)}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              {/* "fact / plan ₾ (%)", as in the period stats; "Скрыть суммы" leaves just the % */}
              <MaskedTotal style={styles.groupTotal} hiddenText={g.planned_minor ? pct(g.spent_minor, g.planned_minor) : shareOfAll(g.spent_minor, stats.spent_minor)}>
                {g.planned_minor ? formatShort(g.spent_minor) : formatWithCurrency(g.spent_minor, stats.currency)}
                {g.planned_minor ? <Text style={styles.rowLimit}> / {formatWithCurrency(g.planned_minor, stats.currency)} ({pct(g.spent_minor, g.planned_minor)})</Text> : null}
              </MaskedTotal>
            </FoldHeader>
            {fold.is(g.title) ? null : g.categories.map((c) => (
              <CategoryRow
                key={String(c.category_id)}
                stat={c}
                total={stats.spent_minor}
                currency={stats.currency}
                evenPace={evenPace}
                dim={daysInMonth(ym)}
                ym={ym}
                openTransactions={openTransactions}
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

      {split.unplanned.length || share > 0 ? (
        <View style={styles.group}>
          <FoldHeader style={[formStyles.sectionHeader, styles.groupHeader]} folded={fold.is(UNPLANNED)} onToggle={() => fold.toggle(UNPLANNED)}>
            <Text style={styles.groupTitle}>{UNPLANNED}</Text>
            <MaskedTotal style={styles.groupTotal} hiddenText={share ? pct(split.spent, share) : shareOfAll(split.spent, stats.spent_minor)}>
              {share ? formatShort(split.spent) : formatWithCurrency(split.spent, stats.currency)}
              {share ? <Text style={styles.rowLimit}> / {formatWithCurrency(share, stats.currency)} ({pct(split.spent, share)})</Text> : null}
            </MaskedTotal>
          </FoldHeader>
          {fold.is(UNPLANNED) ? null : (
            <>
              {/* the share as a limit: an overspend scales the bar to the spending, a tick at the share */}
              {/* nothing spent outside the plan yet: no empty bar, just the hint below */}
              {share > 0 ? (
                // on the header's grey band: the section's total apart from its categories, and what's left of the
                // share for the month — worded like a month limit's row
                <View style={styles.sectionBand}>
                  {split.spent > 0 ? (split.spent > share
                    ? <Meter ratio={1} over={share / split.spent} height={6} color={colors.warn} />
                    : <Meter ratio={split.spent / share} height={6} color={chart.meterFill} />) : null}
                  <Text style={styles.rowStatus}>
                    {split.spent > share
                      ? <Text style={styles.overLine}>Перерасход <Masked style={styles.overLine}>{formatWithCurrency(split.spent - share, stats.currency)}</Masked></Text>
                      : <>осталось <Masked style={styles.rowStatus}>{formatWithCurrency(share - split.spent, stats.currency)}</Masked></>}
                  </Text>
                </View>
              ) : null}
              {split.unplanned.length === 0 ? <Text style={styles.hint}>Трат вне плана пока не было.</Text> : null}
              {split.unplanned.map((c) => (
                <CategoryRow
                  key={String(c.category_id)}
                  stat={c}
                total={stats.spent_minor}
                  currency={stats.currency}
                  evenPace={evenPace}
                  dim={daysInMonth(ym)}
                  ym={ym}
                  openTransactions={openTransactions}
                  monthToDate={0}
                  onAddToPlan={c.category_id !== null && !c.deleted
                    ? () => setPlanTarget({ category_id: c.category_id!, label: categoryLabel(c), limit_minor: 0, currency })
                    : undefined}
                />
              ))}
            </>
          )}
        </View>
      ) : null}

      <RefundsRow amount={stats.refunds_unassigned_minor} currency={stats.currency} onPress={() => openTransactions(null, monthDays(ym), ['refund'])} />
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          {NO_RATE} {stats.other_currencies.map((o) => formatMoneyWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}

      <PlanAmountModal ym={ymOf(year, month)} currency={currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={load} />
    </ScrollView>
  );
}

/** "↩ Возвраты без категории +25 ₾": money back from merchants without a category (subtracted from the total). */
export function RefundsRow({ amount, currency, onPress }: { amount: number; currency: Currency; onPress: () => void }) {
  if (amount <= 0) return null;
  return (
    <TouchableOpacity style={styles.refundsRow} onPress={onPress} accessibilityHint="Показать возвраты без категории">
      <Text style={styles.refundsLabel}>↩ Возвраты без категории</Text>
      <Text style={styles.refundsAmount}>+{formatWithCurrency(amount, currency)}</Text>
    </TouchableOpacity>
  );
}

/** The hole: the month's total, or the tapped category's spending and its share of the total. */
/** the hole's width the amount may take: the ring's inner diameter (220 − 2 × 22) minus some air */
const HOLE_TEXT_WIDTH = 150;
/** a bold digit is about this share of the font size wide */
const CHAR_WIDTH = 0.6;

/** The amount's font size so it fits the hole's width: `max` for a short one, smaller as it gets longer. */
function fitSize(text: string, max: number): number {
  return Math.min(max, Math.floor(HOLE_TEXT_WIDTH / (text.length * CHAR_WIDTH)));
}

/** "34%": a part of the spending, for headers and rows while the amounts are hidden */
function shareOfAll(part: number, whole: number): string {
  return pct(part, whole);
}

export function DonutCenter({ total, picked, currency }: { total: number; picked?: { name: string; emoji: string | null; spent_minor: number }; currency: Currency }) {
  if (!picked) {
    return (
      <>
        <Text style={styles.caption}>Потрачено</Text>
        {/* the currency on the amount's line, as for a tapped segment */}
        <Masked style={[styles.hero, { fontSize: fitSize(formatWithCurrency(total, currency), 34) }]}>{formatWithCurrency(total, currency)}</Masked>
      </>
    );
  }
  const share = total > 0 ? Math.round((picked.spent_minor / total) * 100) : 0;
  return (
    <>
      <Text style={styles.pickedName} numberOfLines={2}>{`${picked.emoji || ''} ${picked.name}`.trim()}</Text>
      <Masked style={[styles.pickedAmount, { fontSize: fitSize(formatWithCurrency(picked.spent_minor, currency), 24) }]}>{formatWithCurrency(picked.spent_minor, currency)}</Masked>
      <Text style={styles.caption}>{share === 0 && picked.spent_minor > 0 ? '<1' : share}% всех трат</Text>
    </>
  );
}

/** the bottom section of the categories without a plan (as in the plan) */
const UNPLANNED = 'Вне плана';

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
      <Masked style={[styles.summaryValue, danger && styles.dangerText]}>{danger ? '⚠ ' : ''}{value}</Masked>
    </View>
  );
}

const RHYTHM_DAYS = { day: 1, week: 7, '2weeks': 14 } as const;
const RHYTHM_NOW = { day: 'Сегодня', week: 'На этой неделе', '2weeks': 'За эти 2 недели' } as const;
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

type NowNorm = Norms['byCategory'] extends Map<number, infer V> ? V : never;

function CategoryRow({ stat, total, currency, evenPace, dim, ym, openTransactions, now, monthToDate, onAddToPlan }: {
  stat: CategoryStat;
  /** the month's spending: a row's share of it when the amounts are hidden */
  total: number;
  currency: Currency; evenPace?: number; dim: number;
  /** the month shown: its operations open for this period */
  ym: string;
  openTransactions: ReturnType<typeof useOpenCategoryTransactions>;
  /** the current month only: the norm window around today */
  now?: NowNorm; monthToDate: number;
  onAddToPlan?: () => void;
}) {
  const { spent_minor: spent, limit_minor: limit } = stat;
  const hidden = useHideAmounts();
  const ratio = limit ? spent / limit : 0;
  // fixed payment (rent, subscription): paid once this month's spending covers its plan (the share is by the amount)
  const fixed = stat.plan_kind === 'fixed';
  const paid = !!limit && spent >= limit;
  const rhythm = !fixed && stat.plan_norm && stat.plan_norm !== 'month' ? stat.plan_norm : null;

  return (
    <TouchableOpacity style={styles.row} onPress={() => openTransactions(stat.category_id, monthDays(ym))} accessibilityHint="Показать операции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: stat.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${stat.emoji || ''} ${stat.name}`.trim()}</Text>
        {/* an obligatory payment: all paid — a green tick, otherwise (partly too) a grey circle */}
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
          {/* "Скрыть суммы": just the % — of its plan, or of all spending without one */}
          {hidden ? (limit ? `${pct(spent, limit)} плана` : `${shareOfAll(spent, total)} трат`)
            : <>{limit ? formatShort(spent) : formatWithCurrency(spent, currency)}{limit ? <Text style={styles.rowLimit}> / {formatWithCurrency(limit, currency)}{planShare(spent, limit)}</Text> : null}</>}
        </Text>
      </View>
      {/* an obligatory payment paid more than planned: an overspend like a limit's */}
      {limit && fixed && spent > limit ? (
        <>
          {/* as everywhere: the bar scaled to the spending, a tick at the plan; the overspend bold orange */}
          <Meter ratio={1} over={limit / spent} height={8} color={stat.color} />
          <Text style={[styles.rowStatus, styles.overLine]}>Перерасход {formatWithCurrency(spent - limit, currency)}</Text>
        </>
      ) : null}
      {limit && !fixed ? (
        <>
          {ratio > 1
            ? <Meter ratio={1} over={limit / spent} height={8} color={stat.color} />
            : <Meter ratio={ratio} height={8} marker={stat.plan_norm === 'month' ? undefined : evenPace} />}
          <Text style={styles.rowStatus}>
            {ratio > 1
              ? <Text style={styles.overLine}>Перерасход {formatWithCurrency(spent - limit, currency)}</Text>
              : `осталось ${formatWithCurrency(limit - spent, currency)}`}
            {/* a category spent daily / weekly: its limit per that period, "лимит ≈ 113 ₾ в неделю" */}
            {/* the current month: this window's limit, rebalanced on what's left of the month; a past one: the plan's share */}
            {/* the month's plan overspent: no limits any more, just the overspend */}
            {rhythm && ratio <= 1 ? (() => {
              const current = now && now.rhythm === rhythm ? now : undefined;
              const flat = current ? flatOf(current.windowParts) : (limit / dim) * RHYTHM_DAYS[rhythm];
              const value = current ? current.windowNorm : flat;
              // more than 5% off the plan's share: "лимит 113 ₾ (crossed out) → 95 ₾"
              const change = limitChange(value, flat);
              return (
                <Text style={styles.rowStatusMuted}>
                  {/* "старый → новый": no "лимит" word, it's plain what it is */}
                  {change ? ' · ' : ' · лимит '}
                  {change ? <Text style={styles.crossed}>{formatWithCurrency(Math.round(flat), currency)}</Text> : '≈ '}
                  {change ? ' → ' : ''}
                  <Text style={change === 'down' ? styles.paceAhead : change === 'up' ? styles.paceOk : undefined}>{formatWithCurrency(Math.round(value), currency)}</Text>
                  {` ${PER_PERIOD[rhythm]}`}
                </Text>
              );
            })() : null}
          </Text>
          {rhythm && ratio <= 1 && now && now.rhythm === rhythm ? (() => {
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
  report: { marginTop: 4 },
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
  // a grey band across the screen, like the days on the operations
  groupHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
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
  rowAmount: { marginLeft: 'auto', paddingLeft: 8, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  rowLimit: { color: colors.muted },
  rowStatus: { fontSize: 13, color: colors.muted, marginTop: 4 },
  rowStatusMuted: { color: colors.muted },
  paceLine: { fontWeight: '600' },
  // an overspend, the same on every screen: bold orange, no ⚠
  sectionBand: { marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, backgroundColor: colors.surface },
  overLine: { color: colors.warn, fontWeight: '600' },
  paceOk: { color: colors.income },
  paceAhead: { color: colors.warn },
  crossed: { textDecorationLine: 'line-through' },
  refundsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingVertical: 10,
    borderTopWidth: 1, borderColor: colors.border,
  },
  refundsLabel: { fontSize: 15, color: colors.muted },
  refundsAmount: { fontSize: 15, color: colors.income, fontVariant: ['tabular-nums'] },
  // under the amount, on the right
  paidMark: { fontSize: 16, fontWeight: '700', marginLeft: 6 },
  paidOn: { color: colors.income },
  paidOff: { color: colors.muted },
});
