import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel } from '../../db/categories';
import { Currency } from '../../db/fx';
import {
  currentYm, getPlanBudget, listPlan, unplannedOf, monthIncome, monthStats, OverBudgetError, parseYm, PlanBudget, planConverter, PlanItem, removePlanItem,
  unplannedSpent,
  setPlanBudget, setPlanPinned,
} from '../../db/plans';
import CurrencyButton from '../CurrencyButton';
import Fab from '../Fab';
import { daysInMonth } from '../dateRange';
import { LockIcon, PencilIcon, PinIcon } from '../icons';
import Masked from '../Masked';
import { useHideAmounts } from '../../hideAmounts';
import StepSlider from '../StepSlider';
import Segmented from '../Segmented';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import { AMOUNT_HINT, NO_SECTION, PER_PERIOD, SPENDING_PATTERN } from '../strings';
import { sheetAlert } from '../sheetAlert';
import { Controller, useWatch } from 'react-hook-form';
import TextInputModal from '../TextInputModal';
import { useLoadedForm } from '../form';
import { formStyles } from '../formStyles';
import { FoldHeader, useFolded } from '../fold';
import PlanAddModal from './PlanAddModal';
import PlanAmountModal, { PlanAmountTarget } from './PlanAmountModal';
import { chart, colors } from '../theme';
import { useLatestRequest } from '../useLatestRequest';
import { toast, toastError } from '../toast';


const RING_FREE = colors.income;
/** "Сбережения" in place of "Не распределено" */
const RING_SAVINGS = '#5eead4';
/** 🔒 locked for savings: the darker part of the savings */
const RING_LOCKED = '#0f766e';
/** the budget's bar, and the 🔒 over its locked part: twice as tall */
const BAR_HEIGHT = 12;
const LOCK_BADGE = BAR_HEIGHT * 2;
/** the share set aside for spending outside the plan */
const RING_UNPLANNED = '#eda100';

const NORM_DAYS = { day: 1, week: 7, '2weeks': 14 } as const;

/** "лимит ≈ 46 ₾ в неделю": a flexible item's plan per its spending pattern (the month's plan / days in the month × days). */
function normText(item: PlanItem, ym: string, currency: Currency): string {
  const amount = item.converted_minor ?? 0;
  if (!amount) return '';
  if (item.norm_period === 'month') return SPENDING_PATTERN.month.title.toLowerCase();
  const per = (amount / daysInMonth(ym)) * NORM_DAYS[item.norm_period];
  return `лимит ≈ ${formatWithCurrency(Math.round(per), currency)} ${PER_PERIOD[item.norm_period]}`;
}

/** Share of the amount to distribute, "35%"; "<1%" for tiny non-zero amounts. */
function percentOf(part: number, whole: number): string {
  if (part <= 0 || whole <= 0) return '';
  const p = Math.round((part / whole) * 100);
  return p === 0 ? '<1%' : `${p}%`;
}

/** Plan items in sections by category type (listPlan returns them in type order); untyped last. Totals converted. */
function groupByType(items: PlanItem[]): Array<{ title: string; planned: number; items: PlanItem[] }> {
  const groups: Array<{ title: string; planned: number; items: PlanItem[] }> = [];
  for (const item of items) {
    const title = item.type_name ?? NO_SECTION;
    let g = groups[groups.length - 1];
    if (!g || g.title !== title) { g = { title, planned: 0, items: [] }; groups.push(g); }
    g.items.push(item);
    g.planned += item.converted_minor ?? 0;
  }
  return groups;
}

/**
 * Plan for one month. A new month starts from the previous month's items:
 * pinned ones keep their amount, the others need a new amount (last month's is shown as a hint).
 * With an amount to distribute set, the plan can't exceed it; the rest is shown as "Свободно".
 * Every amount has the currency it was entered in; the screen shows them in `currency` (the switch on top of
 * the tab), with the original in brackets when it differs.
 */
export default function PlanView({ ym, currency }: { ym: string; currency: Currency }) {
  const hidden = useHideAmounts();
  const [items, setItems] = useState<PlanItem[] | null>(null);
  // where the locked part sits in the budget's bar: its 🔒 is drawn over it, taller than the bar
  const [lockBox, setLockBox] = useState<{ x: number; width: number } | null>(null);
  // amount to distribute (e.g. salary) in its own currency; null = not set (shown as 0, no cap)
  const [budget, setBudget] = useState<PlanBudget | null>(null);
  // converts an amount to the screen's currency on the plan's rate date (null: no rate known)
  const [toShown, setToShown] = useState<(minor: number, from: Currency) => number | null>(() => () => null);
  const [income, setIncome] = useState(0);
  const [budgetOpen, setBudgetOpen] = useState(false);
  // the budget sheet: the amount and the currency it was entered in
  const budgetForm = useLoadedForm<BudgetForm>(
    budgetOpen && items ? {
      value: toInputValue(budget?.amount_minor), currency: budget?.currency ?? currency,
      unplanned: budget && unplannedOf(budget) ? toInputValue(unplannedOf(budget)) : '',
      toSavings: budget?.to_savings ?? true, locked: budget?.locked_minor ? toInputValue(budget.locked_minor) : '',
    } : null, budgetOpen);
  // spent outside the plan this month, in the screen's currency
  const [unplannedSpentMinor, setUnplannedSpent] = useState(0);
  // the month's spending by category (the savings forecast) and in all, in the screen's currency
  const [spentBy, setSpentBy] = useState<{ byCategory: Map<number, number>; total: number }>({ byCategory: new Map(), total: 0 });
  const [editingItem, setEditingItem] = useState<PlanAmountTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // folded sections, remembered
  const fold = useFolded('plan');

  const latest = useLatestRequest();
  const load = useCallback(() => {
    // answers of a previous month / currency (switched quickly) are dropped
    const keep = latest();
    const { year, month } = parseYm(ym);
    Promise.all([listPlan(ym, currency), getPlanBudget(ym), monthIncome(ym, currency), planConverter(ym), monthStats(year, month, currency)])
      .then(keep(([plan, b, inc, conv, stats]: [Awaited<ReturnType<typeof listPlan>>, Awaited<ReturnType<typeof getPlanBudget>>, number, Awaited<ReturnType<typeof planConverter>>, Awaited<ReturnType<typeof monthStats>>]) => {
        setItems(plan); setBudget(b); setIncome(inc); setUnplannedSpent(unplannedSpent(stats));
        setSpentBy({ byCategory: new Map(stats.categories.filter((c) => c.category_id !== null).map((c) => [c.category_id!, c.spent_minor])), total: stats.spent_minor });
        setToShown(() => (minor: number, from: Currency) => conv(minor, from, currency));
      }))
      .catch((e) => console.error('load plan failed', e));
  }, [ym, currency, latest]);

  // on focus, and again whenever load changes while focused (useFocusEffect re-runs on a new callback): no extra useEffect
  useFocusEffect(load);

  const money = (minor: number) => formatWithCurrency(minor, currency);
  // "(200 $)" after an amount shown converted from another currency
  const original = (minor: number, from: Currency) => (from === currency ? '' : ` (${formatWithCurrency(minor, from)})`);
  // an amount in the screen's currency (its own one if there's no rate)
  const inShown = (minor: number, from: Currency) => {
    const c = from === currency ? minor : toShown(minor, from);
    return c === null ? formatWithCurrency(minor, from) : money(c);
  };
  const total = useMemo(() => (items ?? []).reduce((sum, i) => sum + (i.converted_minor ?? 0), 0), [items]);
  // the amount to distribute in the screen's currency (its own one if there's no rate)
  const shownBudget = budget === null ? null : toShown(budget.amount_minor, budget.currency) ?? budget.amount_minor;
  // the share set aside for spending outside the plan, then what nothing claims yet
  const unplanned = shownBudget === null || !budget ? 0 : toShown(unplannedOf(budget), budget.currency) ?? unplannedOf(budget);
  // locked for savings right away (🔒), in the screen's currency
  const locked = !budget || !budget.locked_minor ? 0 : toShown(budget.locked_minor, budget.currency) ?? budget.locked_minor;
  const free = shownBudget === null ? null : shownBudget - total - unplanned - locked;
  // "Сбережения" instead of "Не распределено": what the budget leaves goes there
  const toSavings = !!budget?.to_savings && shownBudget !== null;
  const timing = ym < currentYm() ? 'past' : ym === currentYm() ? 'current' : 'future';
  // savings at the month's end if the rest is spent by plan: every category takes its plan (or what it already took,
  // if more), spending outside the plan its share (or more); a past month: what was actually left
  const savingsEnd = shownBudget === null ? null : timing === 'past' ? shownBudget - spentBy.total
    : timing === 'current'
      ? shownBudget - items!.reduce((a, i) => a + Math.max(i.converted_minor ?? 0, spentBy.byCategory.get(i.category_id) ?? 0), 0)
        - Math.max(unplanned, unplannedSpentMinor)
      : (free ?? 0) + locked;

  // the bar's parts, left to right; "Не распределено" becomes "Сбережения" when the leftover goes there
  const parts: Array<{ key: string; label: string; value: number; color: string; note: string; valueStyle?: object; noteStyle?: object }> = shownBudget ? [
    { key: 'planned', label: 'План', value: total, color: chart.meterFill, note: percentOf(total, shownBudget) || '0%' },
    // the plan shows what is set aside, not what is left of it (that's the stats' job)
    { key: 'unplanned', label: 'Вне плана', value: unplanned, color: RING_UNPLANNED, note: percentOf(unplanned, shownBudget) || '0%' },
    toSavings && timing === 'past'
      ? {
        key: 'free', label: 'Сбережения', value: Math.abs(savingsEnd ?? 0), color: RING_SAVINGS,
        note: (savingsEnd ?? 0) < 0 ? 'бюджет превышен' : 'сэкономлено',
        valueStyle: (savingsEnd ?? 0) < 0 ? styles.overText : styles.savingsValue, noteStyle: (savingsEnd ?? 0) < 0 ? styles.overText : undefined,
      }
      : toSavings
        ? {
          // the locked part and the leftover together: one savings column
          key: 'free', label: 'Сбережения', value: Math.max(0, free ?? 0) + locked, color: RING_SAVINGS,
          // just the sum and its share: what it's made of (🔒 + 🌊) is in the "Сбережения" section below
          note: percentOf(Math.max(0, free ?? 0) + locked, shownBudget) || '0%',
          valueStyle: styles.savingsValue,
        }
        : { key: 'free', label: 'Не распределено', value: Math.max(0, free ?? 0), color: RING_FREE, note: percentOf(free ?? 0, shownBudget) || '0%', valueStyle: styles.freeValue },
    // the locked part apart when the leftover doesn't go to savings
    ...(!toSavings && locked > 0 ? [{ key: 'locked', label: 'Отложено', value: locked, color: RING_LOCKED, note: percentOf(locked, shownBudget) || '0%', valueStyle: styles.lockedValue }] : []),
  ] : [];
  const notes: Array<{ text: string; warn?: boolean }> = [];
  // overspent already: less will be saved by the month's end (a difference under 1% of the budget is noise)
  if (toSavings && timing === 'current' && savingsEnd !== null && (free ?? 0) + locked - savingsEnd >= shownBudget! / 100) {
    notes.push({
      text: savingsEnd <= 0 ? 'Перерасход съел сбережения месяца'
        : hidden ? 'Сбережения к концу месяца будут меньше из-за перерасхода'
          : `Сбережения к концу месяца ≈ ${money(savingsEnd)}, если тратить по плану`,
      warn: true,
    });
  }

  // the plan's system sections: savings (🔒 locked + 🌊 floating: what the plan leaves) and the share outside it
  const systemGroups: Array<{ title: string; rows: Array<{ key: string; name: string; note: string; value: number; style?: object }> }> = [];
  if (shownBudget) {
    const savingsRows = [
      ...(locked > 0 ? [{ key: 'locked', name: '🔒 Сразу', note: 'заблокировано в начале месяца', value: locked, style: styles.lockedValue }] : []),
      ...(toSavings && (free ?? 0) > 0 ? [{ key: 'floating', name: '🌊 Из остатка', note: 'что не запланировано, плюс сэкономленное', value: free!, style: styles.savingsValue }] : []),
    ];
    if (savingsRows.length) systemGroups.push({ title: 'Сбережения', rows: savingsRows });
    if (unplanned > 0) {
      systemGroups.push({
        title: 'Вне плана',
        rows: [{
          // the share set aside only: the spending against it is in the stats
          key: 'unplanned', name: '🎲 Незапланированные траты', value: unplanned, note: 'категории без плана и без категории',
        }],
      });
    }
  }

  /** Saves the amount to distribute (0 / empty = not set); returns an error to show in the dialog, or null. */
  async function saveBudget(text: string): Promise<string | null> {
    const minor = parseAmountOrZero(text);
    if (minor === null) return AMOUNT_HINT;
    const { unplanned: shareText, toSavings: savings, currency: cur, locked: lockedText } = budgetForm.getValues();
    const lockedMinor = parseAmountOrZero(lockedText ?? '');
    const shareMinor = parseAmountOrZero(shareText ?? '');
    if (lockedMinor === null || shareMinor === null) return AMOUNT_HINT;
    // a share right on a stop is kept as a % (it follows the budget), any other as the amount
    const pct = SHARE_STOPS.find((p) => Math.round((minor * p) / 100) === shareMinor);
    try {
      await setPlanBudget(ym, minor === 0 ? null : minor, cur, pct ?? 0, savings, lockedMinor, pct === undefined ? shareMinor : null);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `По категориям уже запланировано ${formatWithCurrency(e.planned_minor, e.currency)} — `
        + (shareMinor || lockedMinor ? 'вместе с отложенным и долей вне плана это больше бюджета.' : 'бюджет не может быть меньше.');
    }
    toast(minor === 0 ? 'Бюджет месяца убран' : 'Бюджет месяца сохранён');
    load();
    return null;
  }

  // a category repeated every month (📌) is asked about: removing it also stops it carrying over
  function removeItem(item: PlanItem) {
    const done = `«${categoryLabel(item)}» убрана из плана`;
    if (!item.pinned) { run(removePlanItem(ym, item.category_id), done); return; }
    sheetAlert(
      `Убрать «${categoryLabel(item)}» из плана?`,
      'Эта категория повторяется каждый месяц (📌). Она пропадёт из плана этого месяца и не перейдёт в следующие. Операции не изменятся.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Убрать из плана', style: 'destructive', onPress: () => { run(removePlanItem(ym, item.category_id), done); } },
      ]);
  }

  /** A change of the plan, then `done` in a toast. */
  async function run(action: Promise<unknown>, done: string) {
    try {
      await action;
      toast(done);
    } catch (e) {
      console.error('plan update failed', e);
      toastError('Не удалось сохранить');
    }
    load();
  }

  if (!items) return <View style={styles.center}><ActivityIndicator /></View>;

  const budgetHint = [
    total > 0 ? `Уже запланировано: ${money(total)}` : '',
    income > 0 ? `Пополнения за месяц: ${money(income)}` : '',
  ].filter(Boolean).join('\n') || 'Сколько денег на месяц, например зарплата. План не сможет его превысить.';

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.budgetBox}>
        {/* the budget in one line, then its split as one bar: planned / for spending outside the plan / savings
            (or not distributed), each part's amount under it in its color */}
        <View style={styles.budgetHead}>
          <Text style={styles.caption}>Бюджет месяца</Text>
          <TouchableOpacity style={styles.budgetRow} onPress={() => setBudgetOpen(true)} accessibilityLabel="Изменить бюджет месяца">
            {/* the amount it was entered in, just the number, right under the converted one */}
            <View style={styles.budgetAmounts}>
              <Masked style={styles.budgetValue}>{money(shownBudget ?? 0)}</Masked>
              {budget && budget.currency !== currency ? (
                <Masked style={styles.budgetOriginal}>{formatWithCurrency(budget.amount_minor, budget.currency)}</Masked>
              ) : null}
            </View>
            {hidden ? null : <View style={styles.pencil}><PencilIcon color={colors.accent} size={18} /></View>}
          </TouchableOpacity>
        </View>

        {shownBudget ? (
          <>
            <View style={styles.barBox}>
              <View style={styles.bar} accessibilityLabel={`Запланировано ${percentOf(total, shownBudget) || '0%'} бюджета`}>
                {/* the savings part: the leftover light, the locked part dark, its 🔒 drawn over it below */}
                {parts.filter((p) => p.key !== 'locked').map((p) => (p.key === 'free' && toSavings && timing !== 'past' ? (
                  <React.Fragment key={p.key}>
                    {(free ?? 0) > 0 ? <View style={{ flex: free!, backgroundColor: p.color }} /> : null}
                    {locked > 0 ? <View style={[styles.lockedPart, { flex: locked }]} onLayout={(e) => setLockBox({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })} /> : null}
                  </React.Fragment>
                ) : p.value > 0 ? <View key={p.key} style={{ flex: p.value, backgroundColor: p.color }} /> : null))}
                {!toSavings && locked > 0 ? <View style={[styles.lockedPart, { flex: locked }]} onLayout={(e) => setLockBox({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })} /> : null}
              </View>
              {/* the 🔒 twice the bar's height, in the middle of the locked part, sticking out above and below */}
              {locked > 0 && lockBox ? (
                <View pointerEvents="none" style={[styles.lockBadgeBox, { left: lockBox.x, width: lockBox.width }]}>
                  <View style={styles.lockBadge}><LockIcon color="#FFFFFF" size={LOCK_BADGE - 10} /></View>
                </View>
              ) : null}
            </View>
            <View style={styles.parts}>
              {/* no share for spending outside the plan: no column for it */}
              {parts.filter((p) => p.key !== 'unplanned' || unplanned > 0).map((p) => (
                <View key={p.key} style={styles.part}>
                  <View style={styles.legend}>
                    {/* savings holding both the leftover and the locked part: half of each, as in the bar */}
                    {p.key === 'free' && locked > 0 && (free ?? 0) > 0 ? (
                      <View style={[styles.legendDot, styles.legendSplit]}>
                        <View style={[styles.legendHalf, { backgroundColor: p.color }]} />
                        <View style={[styles.legendHalf, { backgroundColor: RING_LOCKED }]} />
                      </View>
                    ) : <View style={[styles.legendDot, { backgroundColor: p.key === 'free' && locked > 0 ? RING_LOCKED : p.color }]} />}
                    <Text style={styles.partLabel} numberOfLines={1}>{p.label}</Text>
                  </View>
                  <Masked style={[styles.partValue, p.valueStyle]}>{money(p.value)}</Masked>
                  <Text style={[styles.partNote, p.noteStyle]} numberOfLines={2}>{p.note}</Text>
                </View>
              ))}
            </View>
            {/* under the bar only the savings forecast, once an overspend makes it smaller */}
            {notes.map((n) => <Text key={n.text} style={[styles.note, n.warn && styles.overText]}>{n.text}</Text>)}
          </>
        ) : (
          <Text style={[styles.caption, styles.left]}>
            {total > 0 ? `Запланировано ${money(total)}. ` : ''}Укажите бюджет месяца (например, зарплату): план не сможет его превысить, а у категорий появятся доли в %
          </Text>
        )}
      </View>
      <Text style={styles.pinNote}>📌 — переходит в следующий месяц с той же суммой</Text>

      {items.length === 0 ? <Text style={styles.hint}>План пуст. Нажмите ＋, чтобы добавить категории и суммы.</Text> : null}

      {/* system "categories" first: what the budget sets apart before the plan — savings (locked and floating) and the
          share outside the plan; like the plan's sections, with their share of the budget; a tap opens the budget */}
      {shownBudget ? systemGroups.map((g) => (
        <View key={g.title} style={styles.group}>
          <FoldHeader style={[formStyles.sectionHeader, styles.groupHeader]} folded={fold.is(g.title)} onToggle={() => fold.toggle(g.title)}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            {/* "Скрыть суммы": the share only */}
            <Text style={styles.groupTotal}>
              {hidden ? null : money(g.rows.reduce((a, r) => a + r.value, 0))}
              <Text style={styles.groupShare}>{hidden ? '' : ' · '}{percentOf(g.rows.reduce((a, r) => a + r.value, 0), shownBudget) || '0%'}</Text>
            </Text>
          </FoldHeader>
          {fold.is(g.title) ? null : g.rows.map((r) => (
            <TouchableOpacity key={r.key} style={styles.row} onPress={() => setBudgetOpen(true)} accessibilityLabel={`Изменить: ${r.name}`}>
              {/* system: no pin, a lock in its place */}
              <View style={styles.pin}><LockIcon color={colors.muted} size={20} /></View>
              <View style={styles.nameBox}>
                <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.percent}>{[r.note, `${percentOf(r.value, shownBudget) || '0%'} бюджета`].filter(Boolean).join(' · ')}</Text>
              </View>
              {hidden ? null : (
                <View style={styles.amountBox}>
                  <Text style={[styles.amount, r.style]}>{money(r.value)}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )) : null}

      {groupByType(items).map((g) => (
        <View key={g.title} style={styles.group}>
          <FoldHeader style={[formStyles.sectionHeader, styles.groupHeader]} folded={fold.is(g.title)} onToggle={() => fold.toggle(g.title)}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            {/* the type's share of the amount to distribute; "Скрыть суммы": the share only */}
            <Text style={styles.groupTotal}>
              {hidden && shownBudget ? null : money(g.planned)}
              {shownBudget && g.planned ? <Text style={styles.groupShare}>{hidden ? '' : ' · '}{percentOf(g.planned, shownBudget)}</Text> : null}
            </Text>
          </FoldHeader>
          {fold.is(g.title) ? null : g.items.map((item) => (
            // the whole row opens the item's sheet (amount, kind; delete is in its title); the pin is its own button
            <TouchableOpacity
              key={item.category_id}
              style={styles.row}
              onPress={() => setEditingItem({ ...item, label: categoryLabel(item) })}
              accessibilityLabel={`Изменить: ${categoryLabel(item)}`}
            >
              <TouchableOpacity
                onPress={() => run(setPlanPinned(ym, item.category_id, !item.pinned),
                  item.pinned ? `«${categoryLabel(item)}» больше не повторяется` : `«${categoryLabel(item)}» будет повторяться каждый месяц`)}
                hitSlop={8}
                accessibilityLabel={item.pinned ? 'Не повторять каждый месяц' : 'Повторять каждый месяц'}
                style={styles.pin}
              >
                <PinIcon color={item.pinned ? colors.accent : colors.muted} filled={item.pinned} />
              </TouchableOpacity>
              <View style={styles.nameBox}>
                {/* the type is the section title, so just emoji + name here */}
                <Text style={styles.name} numberOfLines={1}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
                {item.kind === 'fixed' || item.limit_minor || (shownBudget && item.converted_minor) ? (
                  <Text style={styles.percent}>
                    {[
                      item.kind === 'fixed' ? 'обязательный платёж' : '',
                      // a flexible item's amount per its norm rhythm, e.g. "≈ 46 ₾ в неделю"
                      item.kind === 'limit' && !hidden ? normText(item, ym, currency) : '',
                      shownBudget && item.converted_minor ? `${percentOf(item.converted_minor, shownBudget)} бюджета` : '',
                    ].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {/* "Скрыть суммы": the amounts left out (the % of the budget stays in the line under the name) */}
              {hidden ? null : item.limit_minor ? (
                <View style={styles.amountBox}>
                  <Text style={styles.amount}>
                    {item.converted_minor !== null ? money(item.converted_minor) : formatWithCurrency(item.limit_minor, item.currency)}
                  </Text>
                  {item.converted_minor !== null && item.currency !== currency ? (
                    <Text style={styles.amountOriginal}>{original(item.limit_minor, item.currency).trim()}</Text>
                  ) : null}
                </View>
              ) : (
                // carried over without an amount: last month's as a muted hint, in the app's currency
                <Text style={[styles.amount, styles.amountEmpty]}>
                  {item.previous_minor ? `в прошлом месяце ${inShown(item.previous_minor, item.currency)}` : '0'}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TextInputModal
        visible={budgetOpen}
        title="Бюджет месяца"
        hint={budgetHint}
        // the amount and currency it was entered in
        form={budgetForm}
        placeholder="0"
        keyboardType="decimal-pad"
        maxLength={12}
        allowEmpty
        onSubmit={saveBudget}
        onClose={() => setBudgetOpen(false)}
        inputAccessory={<Controller control={budgetForm.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />}
      >
        {/* how much of the budget goes to spending outside the plan: the plan can't take it */}
        <ShareField
          form={budgetForm} name="locked" other="unplanned" planned={total} toShown={toShown} screen={currency}
          title="Отложить сразу" icon color={RING_LOCKED}
          hint={(v, cur) => (v > 0 ? `${formatWithCurrency(v, cur)} сразу в сбережения: план и траты вне плана их не займут.`
            : 'Сколько бюджета сразу заблокировать для сбережений: план и траты вне плана их не займут.')}
        />
        <ShareField
          form={budgetForm} name="unplanned" other="locked" planned={total} toShown={toShown} screen={currency}
          title="На незапланированные траты" color={RING_UNPLANNED}
          hint={(v, cur) => (v > 0 ? `${formatWithCurrency(v, cur)} на траты вне плана — план их не займёт.`
            : 'Сколько бюджета оставить на траты вне плана. Предупреждение в статистике — только если они больше.')}
        />
        <SavingsSwitch form={budgetForm} />
      </TextInputModal>
      <PlanAmountModal
        ym={ym}
        currency={currency}
        target={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={load}
        onDelete={() => { const item = items.find((i) => i.category_id === editingItem?.category_id); if (item) removeItem(item); }}
      />
    </ScrollView>
    {/* like the "+" on the transactions screen: several categories with amounts at once */}
    <Fab onPress={() => setAddOpen(true)} accessibilityLabel="Добавить категории в план" />
    <PlanAddModal ym={ym} currency={currency} visible={addOpen} plannedIds={items.map((i) => i.category_id)} onClose={() => setAddOpen(false)} onSaved={load} />
    </View>
  );
}

const styles = StyleSheet.create({
  share: { marginTop: 4 },
  lockTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  lockMode: { marginLeft: 'auto', width: 120 },
  lockLabel: { marginBottom: 0, marginTop: 0, flexShrink: 1 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lockOwn: { fontSize: 14, color: colors.muted },
  lockInput: { flex: 1, paddingVertical: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  switchLabel: { fontSize: 15, color: colors.text, flex: 1 },
  screen: { flex: 1 },
  // room under the last row for the "+"
  content: { paddingHorizontal: 16, paddingBottom: 88 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  budgetBox: { marginBottom: 8, padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  budgetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  // the pencil at the top, by the amount (not between it and the original one under it)
  budgetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 2 },
  pencil: { marginTop: 5 },
  budgetValue: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  left: { textAlign: 'left' },
  budgetAmounts: { alignItems: 'flex-end' },
  budgetOriginal: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  barBox: { marginTop: 10 },
  bar: { flexDirection: 'row', height: BAR_HEIGHT, borderRadius: 5, overflow: 'hidden', gap: 2, backgroundColor: chart.track },
  lockBadgeBox: { position: 'absolute', top: (BAR_HEIGHT - LOCK_BADGE) / 2, height: LOCK_BADGE, alignItems: 'center', justifyContent: 'center' },
  lockBadge: {
    width: LOCK_BADGE, height: LOCK_BADGE, borderRadius: LOCK_BADGE / 2, backgroundColor: RING_LOCKED,
    borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  parts: { flexDirection: 'row', gap: 8, marginTop: 10 },
  part: { flex: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendSplit: { flexDirection: 'row', overflow: 'hidden' },
  legendHalf: { flex: 1 },
  partLabel: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  partValue: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2, fontVariant: ['tabular-nums'] },
  partNote: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.muted, marginTop: 8 },
  overText: { color: colors.warn },
  savingsValue: { color: RING_LOCKED },
  lockedValue: { color: RING_LOCKED },
  lockedPart: { backgroundColor: RING_LOCKED, alignItems: 'center', justifyContent: 'center' },
  freeValue: { color: colors.income },
  pinNote: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  caption: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 12 },
  // a grey band across the screen, like the days on the operations
  groupHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: -16 },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  groupShare: { color: colors.muted, fontWeight: '400' },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  pin: { paddingRight: 8 },
  nameBox: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, color: colors.text },
  percent: { fontSize: 12, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  amountBox: { alignItems: 'flex-end', paddingLeft: 8 },
  amountOriginal: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  amountEmpty: { color: colors.muted, fontSize: 14 },
});

/** The budget sheet's slider: the share of the budget for spending outside the plan, up to what the plan leaves. */
type BudgetForm = { value: string; currency: Currency; toSavings: boolean; locked: string; unplanned: string };

/** the slider's stops, % of the budget */
const SHARE_STOPS = [0, 10, 20, 30, 40, 50];

/**
 * A part of the budget the plan can't take — "🔒 Отложить сразу", "На незапланированные траты": a % by the slider or an
 * amount of one's own, switched by "% | USD". Kept in the form as an amount in the budget's currency; can't take what is
 * planned or the other part.
 */
function ShareField({ form, name, other, planned, toShown, screen, title, icon, color, hint }: {
  form: ReturnType<typeof useLoadedForm<BudgetForm>>;
  name: 'locked' | 'unplanned';
  other: 'locked' | 'unplanned';
  /** what is planned, in the screen's currency */
  planned: number;
  toShown: (minor: number, from: Currency) => number | null;
  screen: Currency;
  title: string;
  /** 🔒 before the title */
  icon?: boolean;
  color: string;
  hint: (minor: number, currency: Currency) => string;
}) {
  const [value, cur, own, otherText] = useWatch({ control: form.control, name: ['value', 'currency', name, other] });
  const amount = parseAmountOrZero(value ?? '') ?? 0;
  const mine = parseAmountOrZero(own ?? '') ?? 0;
  // what is free for this part, in the budget's currency (the plan: screen → budget by the amount's own rate)
  const inScreen = cur === screen ? amount : toShown(amount, cur) ?? amount;
  const plannedInBudget = inScreen > 0 ? Math.round((planned * amount) / inScreen) : planned;
  const room = Math.max(0, amount - plannedInBudget - (parseAmountOrZero(otherText ?? '') ?? 0));
  const stopOf = (p: number) => Math.round((amount * p) / 100);
  const stop = amount > 0 ? SHARE_STOPS.find((p) => stopOf(p) === mine) : 0;
  const maxStop = amount > 0 ? SHARE_STOPS.filter((p) => stopOf(p) <= room).pop() ?? 0 : 50;
  const set = (minor: number) => form.setValue(name, minor ? toInputValue(minor) : '', { shouldDirty: true });
  // an amount between the stops opens as an amount
  const [mode, setMode] = useState<'pct' | 'amount'>(stop === undefined ? 'amount' : 'pct');
  function switchMode(m: 'pct' | 'amount') {
    // to the slider: the nearest stop that fits
    if (m === 'pct' && stop === undefined && amount > 0) {
      const near = SHARE_STOPS.reduce((b, p) => (Math.abs(stopOf(p) - mine) < Math.abs(stopOf(b) - mine) ? p : b), 0);
      set(stopOf(Math.min(near, maxStop)));
    }
    setMode(m);
  }
  return (
    <View style={styles.share}>
      <View style={styles.lockTitle}>
        {icon ? <LockIcon color={color} size={14} /> : null}
        <Text style={[formStyles.label, styles.lockLabel]}>{title}</Text>
        <Segmented options={[['pct', '%'], ['amount', cur]] as const} value={mode} onChange={switchMode} style={styles.lockMode} />
      </View>
      {mode === 'pct' ? (
        <StepSlider values={SHARE_STOPS} value={stop ?? -1} onChange={(p) => set(stopOf(p))} max={maxStop} label={(v) => `${v}%`} color={color} />
      ) : (
        <View style={styles.lockRow}>
          <Controller
            control={form.control}
            name={name}
            render={({ field }) => (
              <TextInput
                style={[formStyles.input, styles.lockInput]}
                value={field.value}
                onChangeText={field.onChange}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                maxLength={12}
              />
            )}
          />
          <Text style={styles.lockOwn}>{cur}</Text>
        </View>
      )}
      <Text style={[formStyles.hint, mine > room && styles.overText]}>
        {mine > room
          ? `Не помещается: свободно ${formatWithCurrency(room, cur)} — остальное занято планом${other === 'locked' ? ' и отложенным' : ' и долей вне плана'}.`
          : hint(mine, cur)}
      </Text>
    </View>
  );
}

/** "Остаток — в сбережения": the budget sheet's switch, remembered for the next months. */
function SavingsSwitch({ form }: { form: ReturnType<typeof useLoadedForm<BudgetForm>> }) {
  return (
    <View style={styles.share}>
      <Controller
        control={form.control}
        name="toSavings"
        render={({ field }) => (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Остаток — в сбережения</Text>
            <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: RING_SAVINGS, false: colors.border }} thumbColor={colors.bg} />
          </View>
        )}
      />
      <Text style={formStyles.hint}>Что не запланировано и не потрачено, откладывается в категорию «Сбережения». Запоминается на следующие месяцы.</Text>
    </View>
  );
}
