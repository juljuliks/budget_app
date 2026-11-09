import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import Loading from '@/shared/ui/Loading';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { CategoryStat, currentYm, spentOf, StatGroup, ymOf } from '@/db/plans';
import { PlanAmountModal, PlanAmountTarget, splitUnplanned } from '@/entities/plan';
import { FundSheet } from '@/features/fund';
import { MonthReportRow } from '@/features/month-report';
import { RecurringPaymentsSheet } from '@/features/recurring-payments';
import { daysInMonth, monthDays } from '@/shared/lib/dateRange';
import { formatMoneyWithCurrency, formatWithCurrency } from '@/shared/lib/money';
import { NO_RATE } from '@/shared/lib/strings';
import { openCategory, openCategoryTrend, openPlan, useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import { openMonthClose } from '@/shared/navigation/sheets';
import Donut, { DonutSegment } from '@/shared/ui/Donut';
import StickyScrollView from '@/shared/ui/StickyScrollView';
import DonutCenter from '../parts/DonutCenter';
import RefundsRow from '../parts/RefundsRow';
import SavingsLessSheet from '../plan/parts/SavingsLessSheet';
import { getPlanItemBasics } from '@/db/plans';
import { useMonthData } from './model/useMonthData';
import { useMonthUsual } from './model/useMonthUsual';
import { lessTarget, useMonthSavings } from './model/useMonthSavings';
import CategoryRow from './parts/CategoryRow';
import MonthTotal from './parts/MonthTotal';
import PlanLinks from './parts/PlanLinks';
import ComingMonth from './parts/ComingMonth';
import BudgetEditSheet from './parts/BudgetEditSheet';
import FundStatRow, { fundSpentOf } from './parts/FundStatRow';
import { savingsSection } from './parts/savingsSection';
import { categoryActions, fundActions, ROW_MENU_HINT } from './parts/rowActions';
import { fundsSection, spentFunds, typeSections, unplannedSection } from './parts/sections';
import { styles } from './parts/styles';

/**
 * Donut: one segment per category with spending, in section order, so a type's categories sit next to
 * each other in their palette's shades (src/domain/colors.ts).
 */
function donutSegments(groups: StatGroup[]): DonutSegment[] {
  return groups.flatMap((g) => g.categories)
    .filter((c) => c.spent_minor > 0)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color }));
}

/** A month's spending: the donut, the month against its plan, «Сбережения», the categories by section, "Вне плана". */
export default function StatsView({ year, month, currency }: { year: number; month: number; currency: Currency }) {
  const hidden = useHideAmounts();
  const { stats, share, today, load, failed } = useMonthData(year, month, currency);
  // "＋ В план" on a category without a plan amount
  const [planTarget, setPlanTarget] = useState<PlanAmountTarget | null>(null);
  // the donut segment tapped: its category's spending and share in the hole
  const [selected, setSelected] = useState<string | null>(null);
  const segments = useMemo(() => (stats ? donutSegments(stats.groups) : []), [stats]);
  const openTransactions = useOpenCategoryTransactions();
  // «Сбережения»: what goes to savings against the plan; ⓘ — what the overspend took
  // in the currency of the month's budget, as its "Итоги" (the funds' progress — in their own)
  const savings = useMonthSavings(ymOf(year, month), currency, hidden);
  // the current month: "+44% к обычному" under a category spent well off its usual
  const usual = useMonthUsual(ymOf(year, month), currency);
  const [lessOpen, setLessOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState<{ id: number; name: string; emoji: string | null } | null>(null);
  const [fundSheet, setFundSheet] = useState<{ id: number; label: string } | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);

  async function openPlanEdit(c: CategoryStat) {
    if (!c.category_id || c.deleted || !stats) return;
    try {
      if (c.limit_minor !== null) {
        const item = await getPlanItemBasics(ymOf(year, month), c.category_id);
        if (!item) return;
        if (item.by_merchant) { setSubsOpen({ id: c.category_id, name: c.name, emoji: c.emoji }); return; }
        setPlanTarget({ category_id: c.category_id, label: categoryLabel(c), ...item });
      } else {
        setPlanTarget({ category_id: c.category_id, label: categoryLabel(c), limit_minor: 0, currency: stats.currency, suggested_minor: spentOf(c) || undefined });
      }
    } catch (e) {
      console.error('open plan edit', e);
    }
  }


  async function openSheetAmount(id: number, label: string, close: () => void) {
    const item = await getPlanItemBasics(ymOf(year, month), id);
    if (item) { close(); setPlanTarget({ category_id: id, label, ...item }); }
  }

  // the next month: nothing spent yet, its plan in advance
  if (ymOf(year, month) > currentYm()) return <ComingMonth ym={ymOf(year, month)} />;
  if (!stats) return <Loading failed={failed} onRetry={load} />;

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
      usual={c.category_id === null ? undefined : usual.get(c.category_id)}
      onAddToPlan={c.category_id !== null && !unplanned && c.limit_minor === null && !c.deleted && spentOf(c) > 0
        ? () => setPlanTarget({ category_id: c.category_id!, label: categoryLabel(c), limit_minor: 0, currency: stats.currency, suggested_minor: c.spent_minor })
        : undefined}
      actions={categoryActions(c, {
        spending: () => openTransactions(c.category_id, monthDays(ym)),
        plan: () => { openPlanEdit(c).catch((e) => console.error('open plan edit failed', e)); },
        trend: () => openCategoryTrend(c.category_id!),
      })}
    />
  );

  return (
    <StickyScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* under the month, on the right: its plan */}
      <PlanLinks ym={ym} />
      {/* a month that is over: its report on top */}
      {ym < currentYm() ? <View style={styles.report}><MonthReportRow ym={ym} /></View> : null}
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={stats.currency} />
        </Donut>
      </View>
      {plannedAll > 0 ? <MonthTotal stats={stats} ym={ym} plannedAll={plannedAll} evenPace={evenPace} onEditPlan={() => openPlan(ym)} /> : (
        <Text style={styles.hint}>Составьте план на месяц, чтобы видеть, сколько осталось по категориям.</Text>
      )}

      {stats.categories.length > 0 || spentFunds(stats).length ? <Text style={styles.longPressHint}>{ROW_MENU_HINT}</Text> : null}
      {savingsSection(savings.section, savings.currency, {
        less: () => setLessOpen(true),
        close: openMonthClose,
        longPressCategory: (id, name) => setSubsOpen({ id, name, emoji: null }),
        fundActions: (id, name) => fundActions(id, ym, openTransactions, () => setFundSheet({ id, label: name })),
        onLongPressLocked: () => setBudgetOpen(true),
        // a fund spent from: said under its part; without one there — in "Копилки"
        fundSpent: fundSpentOf(stats, ym, hidden),
      })}
      {fundsSection(stats, (f) => (
        <FundStatRow key={f.category_id} f={f} ym={ym} currency={stats.currency} hidden={hidden} actions={fundActions(f.category_id, ym, openTransactions, () => setFundSheet({ id: f.category_id, label: `${f.emoji || ''} ${f.name}`.trim() }))} />
      ), savings.section)}
      {stats.categories.length === 0 && !spentFunds(stats).length ? <Text style={styles.hint}>В этом месяце трат нет.</Text> : typeSections(stats, split.groups, rowOf)}
      {unplannedSection(stats, split, share, rowOf, hidden)}

      <RefundsRow amount={stats.refunds_unassigned_minor} currency={stats.currency} onPress={() => openTransactions(null, monthDays(ym), ['refund'])} />
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          {NO_RATE} {stats.other_currencies.map((o) => formatMoneyWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}

      <PlanAmountModal ym={ym} currency={currency} target={planTarget} onClose={() => setPlanTarget(null)} onSaved={load} />
      <SavingsLessSheet
        less={savings.view?.less ?? null} visible={lessOpen} money={(minor) => formatWithCurrency(minor, savings.currency)} onClose={() => setLessOpen(false)}
        onOpen={(id) => setPlanTarget(lessTarget(savings.view, id))}
      />
      <RecurringPaymentsSheet
        ym={subsOpen !== null ? ymOf(year, month) : null}
        category={subsOpen ?? { id: 0, name: '', emoji: null }}
        currency={currency}
        onClose={() => setSubsOpen(null)}
        onEditAmount={() => subsOpen && openSheetAmount(subsOpen.id, categoryLabel(subsOpen), () => setSubsOpen(null))}
      />
      <FundSheet
        categoryId={fundSheet?.id ?? null}
        label={fundSheet?.label ?? ''}
        onClose={() => setFundSheet(null)}
        // a fund is changed on its category's page
        onEdit={() => { const f = fundSheet; setFundSheet(null); if (f) openCategory(f.id); }}
      />
      <BudgetEditSheet ym={ym} currency={currency} visible={budgetOpen} onClose={() => setBudgetOpen(false)} />
    </StickyScrollView>
  );
}
