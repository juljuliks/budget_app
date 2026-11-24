import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { useRowMenuUsed } from '@/shared/settings/rowMenuHint';
import Loading from '@/shared/ui/Loading';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { CategoryStat, currentYm, spentOf, ymOf } from '@/db/plans';
import { splitUnplanned } from '@/entities/plan';
import { FundSheet } from '@/features/fund';
import { MonthReportRow } from '@/features/month-report';
import { type PaymentsView, RecurringPaymentsSheet } from '@/features/recurring-payments';
import { daysInMonth, monthDays } from '@/shared/lib/dateRange';
import { formatMoneyWithCurrency, formatWithCurrency } from '@/shared/lib/money';
import { NO_RATE } from '@/shared/lib/strings';
import { openCategory, openCategoryTrend, useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import { openMonthClose } from '@/shared/navigation/sheets';
import { useFabOnScroll } from '@/shared/lib/useFabOnScroll';
import Fab from '@/shared/ui/Fab';
import StickyScrollView from '@/shared/ui/StickyScrollView';
import RefundsRow from '../parts/RefundsRow';
import SavingsLessSheet from '../plan/parts/SavingsLessSheet';
import { getPlanItemBasics } from '@/db/plans';
import { useMonthData } from './model/useMonthData';
import { useMonthUsual } from './model/useMonthUsual';
import { lessTarget, useMonthSavings } from './model/useMonthSavings';
import CategoryRow from './parts/CategoryRow';
import MonthDonut from './parts/MonthDonut';
import MonthTotal from './parts/MonthTotal';
import CarryLines from './parts/CarryLines';
import NoPlan from './parts/NoPlan';
import { donutInput } from './parts/donutInput';
import { usePlanSheets } from './parts/usePlanSheets';
import { planList } from './parts/planList';
import type { DonutView } from './model/donutSlices';
import FundStatRow, { fundSpentOf } from './parts/FundStatRow';
import { savingsSection } from './parts/savingsSection';
import { categoryActions, fundActions, ROW_MENU_HINT } from './parts/rowActions';
import { fundsSection, spentFunds, typeSections, unplannedSection } from './parts/sections';
import { styles } from './parts/styles';

type Props = { year: number; month: number; currency: Currency; view: DonutView };

/**
 * A month: «Траты» — the spending's ring, the month against its plan, the categories by section, "Вне плана",
 * «Сбережения»; «План» — the plan's ring and the categories' plans by section, no spending.
 */
export default function StatsView({ year, month, currency, view }: Props) {
  const hidden = useHideAmounts();
  const { stats, share, today, marks, load, failed } = useMonthData(year, month, currency);
  const openTransactions = useOpenCategoryTransactions();
  // «Сбережения»: what goes to savings against the plan; ⓘ — what the overspend took
  // in the currency of the month's budget, as its "Итоги" (the funds' progress — in their own)
  const savings = useMonthSavings(ymOf(year, month), currency, hidden);
  // the current month: "+44% к обычному" under a category spent well off its usual
  const usual = useMonthUsual(ymOf(year, month), currency);
  const [lessOpen, setLessOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState<{ id: number; name: string; emoji: string | null; view?: PaymentsView } | null>(null);
  const [fundSheet, setFundSheet] = useState<{ id: number; label: string } | null>(null);
  // the plan, changed here: its budget, «＋», an amount, the carry
  const plan = usePlanSheets(ymOf(year, month), currency);
  const fab = useFabOnScroll();
  // «Зажмите категорию — …»: until a long press's button is used once
  const menuUsed = useRowMenuUsed();

  async function openPlanEdit(c: CategoryStat) {
    if (!c.category_id || c.deleted || !stats) return;
    try {
      const item = await getPlanItemBasics(ymOf(year, month), c.category_id);
      // the subscriptions' category with its payments on (0 this month too): their list, as the plan's row was
      if (item?.by_merchant && item.recurring) { setSubsOpen({ id: c.category_id, name: c.name, emoji: c.emoji }); return; }
      if (item && c.limit_minor !== null) plan.openAmount({ category_id: c.category_id, label: categoryLabel(c), ...item });
      else plan.openAmount({ category_id: c.category_id, label: categoryLabel(c), limit_minor: 0, currency: stats.currency, suggested_minor: spentOf(c) || undefined });
    } catch (e) {
      console.error('open plan edit', e);
    }
  }



  if (!stats) return <Loading failed={failed} onRetry={load} />;

  // the categories without a plan and the uncategorized: one "Вне плана" section at the bottom, with the budget's share
  const split = splitUnplanned(stats.groups, (c) => c.limit_minor !== null);
  // the plan's categories and the share outside them: what's left of both (an overspend outside the plan too)
  const plannedAll = stats.planned_minor + share;
  // the current month: a tick on each flexible category's bar where an even pace would be today
  const ym = ymOf(year, month);
  const evenPace = ym === currentYm() ? new Date().getDate() / daysInMonth(ym) : undefined;
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
      usual={c.category_id === null ? undefined : usual.get(c.category_id)} note={c.category_id === null ? undefined : plan.notes.get(c.category_id)} charges={c.category_id === null ? undefined : plan.charges.get(c.category_id)}
      onAddToPlan={c.category_id !== null && !unplanned && c.limit_minor === null && !c.deleted && spentOf(c) > 0
        ? () => plan.openAmount({ category_id: c.category_id!, label: categoryLabel(c), limit_minor: 0, currency: stats.currency, suggested_minor: c.spent_minor })
        : undefined}
      actions={categoryActions(c, {
        spending: () => openTransactions(c.category_id, monthDays(ym)),
        plan: () => { openPlanEdit(c).catch((e) => console.error('open plan edit failed', e)); },
        trend: () => openCategoryTrend(c.category_id!),
        category: () => openCategory(c.category_id!),
      })}
    />
  );

  return (
    <View style={styles.screen}>
    <StickyScrollView style={styles.screen} contentContainerStyle={styles.content} testID="month-stats" onScroll={fab.onScroll} scrollEventThrottle={100}>
      {/* a month that is over: its report on top */}
      {ym < currentYm() ? <View style={styles.report}><MonthReportRow ym={ym} /></View> : null}
      {view === 'plan' && plannedAll <= 0 ? null : <MonthDonut stats={stats} view={view} plannedAll={plannedAll} input={donutInput(split.groups, { share, spent: split.spent }, savings.section, plan.shareBase(plannedAll).minor)} word={plan.shareBase(plannedAll).word} onBudget={plan.openBudget} />}
      {view === 'plan' ? (
        <>
          {plannedAll > 0 ? null : <NoPlan onBudget={plan.openBudget} />}
          {planList(plan, ym, currency, { subs: (i) => setSubsOpen({ id: i.category_id, name: i.name, emoji: i.emoji }), fund: (i) => setFundSheet({ id: i.category_id, label: `${i.emoji || ''} ${i.name}`.trim() }) })}
        </>
      ) : <>
      {plannedAll > 0 ? <MonthTotal stats={stats} ym={ym} plannedAll={plannedAll} evenPace={evenPace} marks={marks} /> : (
        <NoPlan onBudget={plan.openBudget} />
      )}
      <CarryLines p={plan.p} onOpen={plan.openCarry} />

      {!menuUsed && (stats.categories.length > 0 || spentFunds(stats).length) ? <Text style={styles.longPressHint}>{ROW_MENU_HINT}</Text> : null}
      {stats.categories.length === 0 && !spentFunds(stats).length ? <Text style={styles.hint}>В этом месяце трат нет.</Text> : typeSections(stats, split.groups, rowOf, plan.shareBase(plannedAll))}
      {unplannedSection(stats, split, share, rowOf, hidden, plan.shareBase(plannedAll))}

      {/* savings after the spending: during the month what is spent is what is looked at */}
      {savingsSection(savings.section, savings.currency, {
        less: () => setLessOpen(true),
        close: openMonthClose,
        longPressCategory: (id) => { const c = stats.categories.find((x) => x.category_id === id); setSubsOpen({ id, name: c?.name ?? '', emoji: c?.emoji ?? null, view: 'upcoming' }); },
        fundActions: (id, name) => fundActions(id, ym, openTransactions, () => setFundSheet({ id, label: name })),
        onLongPressLocked: plan.openBudget,
        // a fund spent from: said under its part; without one there — in "Копилки"
        fundSpent: fundSpentOf(stats, ym, hidden),
        openCategory,
      })}
      {fundsSection(stats, (f) => (
        <FundStatRow key={f.category_id} f={f} ym={ym} currency={stats.currency} hidden={hidden} actions={fundActions(f.category_id, ym, openTransactions, () => setFundSheet({ id: f.category_id, label: `${f.emoji || ''} ${f.name}`.trim() }))} />
      ), savings.section)}
      <RefundsRow amount={stats.refunds_unassigned_minor} currency={stats.currency} onPress={() => openTransactions(null, monthDays(ym), ['refund'])} />
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          {NO_RATE} {stats.other_currencies.map((o) => formatMoneyWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}
      </>}

      <SavingsLessSheet
        ym={ym} currency={savings.currency} less={savings.view?.less ?? null} visible={lessOpen} money={(minor) => formatWithCurrency(minor, savings.currency)} onClose={() => setLessOpen(false)}
        onOpen={(id) => plan.openAmount(lessTarget(savings.view, id))}
      />
      <RecurringPaymentsSheet
        ym={subsOpen !== null ? ymOf(year, month) : null}
        category={subsOpen ?? { id: 0, name: '', emoji: null }}
        currency={currency}
        view={subsOpen?.view}
        onClose={() => setSubsOpen(null)}
        onEditAmount={() => subsOpen && plan.openItem(subsOpen.id, categoryLabel(subsOpen), () => setSubsOpen(null))}
      />
      <FundSheet
        categoryId={fundSheet?.id ?? null}
        label={fundSheet?.label ?? ''}
        onClose={() => setFundSheet(null)}
        // a fund is changed on its category's page
        onEdit={() => { const f = fundSheet; setFundSheet(null); if (f) openCategory(f.id); }}
      />
    </StickyScrollView>
    {/* out of the scroll's children: a section coming or going doesn't remount them */}
    {plan.sheets}
    {/* "Добавить в план": step 1 the category, step 2 its amount; hidden while scrolling down */}
    {fab.shown ? <Fab onPress={plan.openAdd} accessibilityLabel="Добавить в план" /> : null}
    </View>
  );
}
