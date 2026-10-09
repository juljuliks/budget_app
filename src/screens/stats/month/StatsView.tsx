import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { CategoryStat, currentYm, spentOf, StatGroup, ymOf } from '@/db/plans';
import { PlanAmountModal, PlanAmountTarget, splitUnplanned } from '@/entities/plan';
import { MonthReportRow } from '@/features/month-report';
import { daysInMonth, monthDays } from '@/shared/lib/dateRange';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { NO_RATE } from '@/shared/lib/strings';
import { useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import Donut, { DonutSegment } from '@/shared/ui/Donut';
import StickyScrollView from '@/shared/ui/StickyScrollView';
import DonutCenter from '../parts/DonutCenter';
import RefundsRow from '../parts/RefundsRow';
import { useMonthData } from './model/useMonthData';
import CategoryRow from './parts/CategoryRow';
import MonthTotal from './parts/MonthTotal';
import { typeSections, unplannedSection } from './parts/sections';
import { styles } from './parts/styles';

/**
 * Donut: one segment per category with spending, in section order, so a type's categories sit next to
 * each other in their palette's shades (src/colors.ts).
 */
function donutSegments(groups: StatGroup[]): DonutSegment[] {
  return groups.flatMap((g) => g.categories)
    .filter((c) => c.spent_minor > 0)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color }));
}

/** A month's spending: the donut, the month against its plan, the categories by section, "Вне плана". */
export default function StatsView({ year, month, currency }: { year: number; month: number; currency: Currency }) {
  const { stats, share, today, load } = useMonthData(year, month, currency);
  // "＋ В план" on a category without a plan amount
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  // the donut segment tapped: its category's spending and share in the hole
  const [selected, setSelected] = useState<string | null>(null);
  const segments = useMemo(() => (stats ? donutSegments(stats.groups) : []), [stats]);
  const openTransactions = useOpenCategoryTransactions();

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;

  // the categories without a plan and the uncategorized: one "Вне плана" section at the bottom, with the budget's share
  const split = splitUnplanned(stats.groups, (c) => c.limit_minor !== null);
  // the plan's categories and the share outside them: what's left of both (an overspend outside the plan too)
  const plannedAll = stats.planned_minor + share;
  // the current month: a tick on each flexible category's bar where an even pace would be today
  const ym = ymOf(year, month);
  const evenPace = ym === currentYm() ? new Date().getDate() / daysInMonth(ym) : undefined;
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);
  const rowOf = (c: CategoryStat, unplanned: boolean) => (
    <CategoryRow
      key={String(c.category_id)}
      stat={c}
      total={stats.spent_minor}
      currency={stats.currency}
      evenPace={evenPace}
      dim={daysInMonth(ym)}
      ym={ym}
      openTransactions={openTransactions}
      now={unplanned || c.category_id === null ? undefined : today?.byCategory.get(c.category_id)}
      monthToDate={unplanned || c.category_id === null ? 0 : today?.monthToDate.get(c.category_id) ?? 0}
      withType={unplanned}
      onAddToPlan={c.category_id !== null && (unplanned || c.limit_minor === null) && !c.deleted && spentOf(c) > 0
        ? () => setPlanTarget({ category_id: c.category_id!, label: categoryLabel(c), limit_minor: 0, currency: stats.currency, suggested_minor: c.spent_minor })
        : undefined}
    />
  );

  return (
    <StickyScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* a month that is over: its report on top */}
      {ym < currentYm() ? <View style={styles.report}><MonthReportRow ym={ym} /></View> : null}
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={stats.currency} />
        </Donut>
      </View>
      {plannedAll > 0 ? <MonthTotal stats={stats} ym={ym} plannedAll={plannedAll} evenPace={evenPace} /> : (
        <Text style={styles.hint}>Составьте план на месяц во вкладке «План», чтобы видеть, сколько осталось по категориям.</Text>
      )}

      {stats.categories.length === 0 ? <Text style={styles.hint}>В этом месяце трат нет.</Text> : typeSections(stats, split.groups, rowOf)}
      {unplannedSection(stats, split, share, rowOf)}

      <RefundsRow amount={stats.refunds_unassigned_minor} currency={stats.currency} onPress={() => openTransactions(null, monthDays(ym), ['refund'])} />
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          {NO_RATE} {stats.other_currencies.map((o) => formatMoneyWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}

      <PlanAmountModal ym={ym} currency={currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={load} />
    </StickyScrollView>
  );
}
