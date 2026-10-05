import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel } from '../../db/categories';
import { Currency } from '../../db/fx';
import {
  getPlanBudget, listPlan, monthIncome, OverBudgetError, PlanBudget, planConverter, PlanItem, removePlanItem,
  setPlanBudget, setPlanPinned,
} from '../../db/plans';
import CurrencyButton from '../CurrencyButton';
import Fab from '../Fab';
import { daysInMonth } from '../dateRange';
import { PencilIcon, PinIcon } from '../icons';
import Meter from '../Meter';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import { AMOUNT_HINT, NO_SECTION, PER_PERIOD, SPENDING_PATTERN } from '../strings';
import { sheetAlert } from '../sheetAlert';
import { Controller } from 'react-hook-form';
import TextInputModal from '../TextInputModal';
import { useLoadedForm } from '../form';
import { formStyles } from '../formStyles';
import PlanAddModal from './PlanAddModal';
import PlanAmountModal, { PlanAmountTarget } from './PlanAmountModal';
import { chart, colors } from '../theme';
import { useLatestRequest } from '../useLatestRequest';
import { toast, toastError } from '../toast';


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
  const [items, setItems] = useState<PlanItem[] | null>(null);
  // amount to distribute (e.g. salary) in its own currency; null = not set (shown as 0, no cap)
  const [budget, setBudget] = useState<PlanBudget | null>(null);
  // converts an amount to the screen's currency on the plan's rate date (null: no rate known)
  const [toShown, setToShown] = useState<(minor: number, from: Currency) => number | null>(() => () => null);
  const [income, setIncome] = useState(0);
  const [budgetOpen, setBudgetOpen] = useState(false);
  // the budget sheet: the amount and the currency it was entered in
  const budgetForm = useLoadedForm<{ value: string; currency: Currency }>(
    budgetOpen && items ? { value: toInputValue(budget?.amount_minor), currency: budget?.currency ?? currency } : null, budgetOpen);
  const [editingItem, setEditingItem] = useState<PlanAmountTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const latest = useLatestRequest();
  const load = useCallback(() => {
    // answers of a previous month / currency (switched quickly) are dropped
    const keep = latest();
    Promise.all([listPlan(ym, currency), getPlanBudget(ym), monthIncome(ym, currency), planConverter(ym)])
      .then(keep(([plan, b, inc, conv]: [Awaited<ReturnType<typeof listPlan>>, Awaited<ReturnType<typeof getPlanBudget>>, number, Awaited<ReturnType<typeof planConverter>>]) => {
        setItems(plan); setBudget(b); setIncome(inc);
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
  const free = shownBudget === null ? null : shownBudget - total;

  /** Saves the amount to distribute (0 / empty = not set); returns an error to show in the dialog, or null. */
  async function saveBudget(text: string): Promise<string | null> {
    const minor = parseAmountOrZero(text);
    if (minor === null) return AMOUNT_HINT;
    try {
      await setPlanBudget(ym, minor === 0 ? null : minor, budgetForm.getValues('currency'));
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `По категориям уже запланировано ${formatWithCurrency(e.planned_minor, e.currency)} — бюджет не может быть меньше.`;
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
        <Text style={styles.caption}>Бюджет месяца</Text>
        <TouchableOpacity
          style={styles.budgetRow}
          onPress={() => setBudgetOpen(true)}
          accessibilityLabel="Изменить бюджет месяца"
        >
          <Text style={styles.budgetValue}>{money(shownBudget ?? 0)}</Text>
          <PencilIcon color={colors.accent} size={20} />
        </TouchableOpacity>
        {budget && budget.currency !== currency ? (
          <Text style={styles.caption}>{original(budget.amount_minor, budget.currency).trim()}</Text>
        ) : null}

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Запланировано</Text>
            <Text style={styles.summaryValue}>{money(total)}</Text>
            {shownBudget ? <Text style={styles.caption}>{percentOf(total, shownBudget) || '0%'}</Text> : null}
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Не распределено</Text>
            <Text style={[styles.summaryValue, free !== null && styles.freeValue]}>{free === null ? '—' : money(free)}</Text>
            {shownBudget ? <Text style={styles.caption}>{percentOf(free ?? 0, shownBudget) || '0%'}</Text> : null}
          </View>
        </View>
        {shownBudget ? (
          // share of the amount already distributed: not a spent/limit meter, so no warning colors
          <Meter ratio={total / shownBudget} color={chart.meterFill} />
        ) : (
          <Text style={styles.caption}>Укажите бюджет месяца (например, зарплату): план не сможет его превысить, а у категорий появятся доли в %</Text>
        )}
        <Text style={[styles.caption, styles.pinNote]}>📌 — повторять каждый месяц: категория перейдёт в следующий месяц с той же суммой</Text>
      </View>

      {items.length === 0 ? <Text style={styles.hint}>План пуст. Нажмите ＋, чтобы добавить категории и суммы.</Text> : null}

      {groupByType(items).map((g) => (
        <View key={g.title} style={styles.group}>
          <View style={[formStyles.sectionHeader, styles.groupHeader]}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <Text style={styles.groupTotal}>
              {money(g.planned)}
              {/* the type's share of the amount to distribute */}
              {shownBudget && g.planned ? <Text style={styles.groupShare}> · {percentOf(g.planned, shownBudget)}</Text> : null}
            </Text>
          </View>
          {g.items.map((item) => (
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
                      item.kind === 'limit' ? normText(item, ym, currency) : '',
                      shownBudget && item.converted_minor ? `${percentOf(item.converted_minor, shownBudget)} бюджета` : '',
                    ].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {item.limit_minor ? (
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
      />
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
  screen: { flex: 1 },
  // room under the last row for the "+"
  content: { paddingHorizontal: 16, paddingBottom: 88 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  budgetBox: {
    alignItems: 'center', marginBottom: 12, padding: 16, borderRadius: 12, backgroundColor: colors.surface,
  },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, paddingVertical: 4, paddingHorizontal: 8 },
  budgetValue: { fontSize: 26, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  summary: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 14 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '600', color: colors.text, marginVertical: 2, fontVariant: ['tabular-nums'] },
  freeValue: { color: colors.income },
  pinNote: { marginTop: 10 },
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
