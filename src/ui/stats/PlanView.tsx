import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel } from '../../db/categories';
import { Currency } from '../../db/fx';
import {
  getPlanBudget, listPlan, monthIncome, OverBudgetError, PlanBudget, planConverter, PlanItem, removePlanItem,
  setPlanBudget, setPlanPinned,
} from '../../db/plans';
import CurrencyPicker from '../CurrencyPicker';
import Fab from '../Fab';
import { daysInMonth } from '../dateRange';
import { PencilIcon, PinIcon } from '../icons';
import Meter from '../Meter';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import RowActions, { ROW_ICON_SIZE } from '../RowActions';
import TextInputModal from '../TextInputModal';
import PlanAddModal from './PlanAddModal';
import PlanAmountModal, { PlanAmountTarget } from './PlanAmountModal';
import { chart, colors } from '../theme';


const NORM_LABELS = { day: 'в день', week: 'в неделю', '2weeks': 'за 2 недели', month: 'в месяц' } as const;
const NORM_DAYS = { day: 1, week: 7, '2weeks': 14 } as const;

/** "≈ 46 ₾ в неделю": a flexible item's amount per its norm rhythm (the month's plan / days in the month × days). */
function normText(item: PlanItem, ym: string, currency: Currency): string {
  const amount = item.converted_minor ?? 0;
  if (!amount) return '';
  if (item.norm_period === 'month') return `${formatWithCurrency(amount, currency)} ${NORM_LABELS.month}`;
  const per = (amount / daysInMonth(ym)) * NORM_DAYS[item.norm_period];
  return `≈ ${formatWithCurrency(Math.round(per), currency)} ${NORM_LABELS[item.norm_period]}`;
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
    const title = item.type_name ?? 'Без типа';
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
  const [budgetCurrency, setBudgetCurrency] = useState<Currency>(currency);
  const [income, setIncome] = useState(0);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanAmountTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([listPlan(ym, currency), getPlanBudget(ym), monthIncome(ym, currency), planConverter(ym)])
      .then(([plan, b, inc, conv]) => {
        setItems(plan); setBudget(b); setIncome(inc);
        setToShown(() => (minor: number, from: Currency) => conv(minor, from, currency));
      })
      .catch((e) => console.error('load plan failed', e));
  }, [ym, currency]);

  useFocusEffect(load);
  useEffect(load, [load]);

  const money = (minor: number) => formatWithCurrency(minor, currency);
  // "(200 $)" after an amount shown converted from another currency
  const original = (minor: number, from: Currency) => (from === currency ? '' : ` (${formatWithCurrency(minor, from)})`);
  const total = useMemo(() => (items ?? []).reduce((sum, i) => sum + (i.converted_minor ?? 0), 0), [items]);
  // the amount to distribute in the screen's currency (its own one if there's no rate)
  const shownBudget = budget === null ? null : toShown(budget.amount_minor, budget.currency) ?? budget.amount_minor;
  const free = shownBudget === null ? null : shownBudget - total;

  /** Saves the amount to distribute (0 / empty = not set); returns an error to show in the dialog, or null. */
  async function saveBudget(text: string): Promise<string | null> {
    const minor = parseAmountOrZero(text);
    if (minor === null) return 'Введите сумму, например 1500 или 12.50';
    try {
      await setPlanBudget(ym, minor === 0 ? null : minor, budgetCurrency);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `По категориям уже запланировано ${formatWithCurrency(e.planned_minor, e.currency)} — сумма не может быть меньше.`;
    }
    load();
    return null;
  }

  async function run(action: Promise<unknown>) {
    try { await action; } catch (e) { console.error('plan update failed', e); }
    load();
  }

  if (!items) return <View style={styles.center}><ActivityIndicator /></View>;

  const budgetHint = [
    total > 0 ? `Уже запланировано: ${money(total)}` : '',
    income > 0 ? `Поступления за месяц: ${money(income)}` : '',
  ].filter(Boolean).join('\n') || 'Например, зарплата. План не сможет её превысить.';

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.budgetBox}>
        <Text style={styles.caption}>Сумма к планированию</Text>
        <TouchableOpacity
          style={styles.budgetRow}
          onPress={() => { setBudgetCurrency(budget?.currency ?? currency); setBudgetOpen(true); }}
          accessibilityLabel="Изменить сумму к планированию"
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
            <Text style={styles.caption}>Свободно</Text>
            <Text style={[styles.summaryValue, free !== null && styles.freeValue]}>{free === null ? '—' : money(free)}</Text>
            {shownBudget ? <Text style={styles.caption}>{percentOf(free ?? 0, shownBudget) || '0%'}</Text> : null}
          </View>
        </View>
        {shownBudget ? (
          // share of the amount already distributed: not a spent/limit meter, so no warning colors
          <Meter ratio={total / shownBudget} color={chart.meterFill} />
        ) : (
          <Text style={styles.caption}>Укажите сумму (например, зарплату): план не сможет её превысить, а у категорий появятся доли в %</Text>
        )}
        <Text style={[styles.caption, styles.pinNote]}>📌 — пункт перейдёт в следующий месяц вместе с суммой</Text>
      </View>

      {items.length === 0 ? <Text style={styles.hint}>План пуст. Нажмите ＋, чтобы добавить категории и суммы.</Text> : null}

      {groupByType(items).map((g) => (
        <View key={g.title} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <Text style={styles.groupTotal}>
              {money(g.planned)}
              {/* the type's share of the amount to distribute */}
              {shownBudget && g.planned ? <Text style={styles.groupShare}> · {percentOf(g.planned, shownBudget)}</Text> : null}
            </Text>
          </View>
          {g.items.map((item) => (
            <View key={item.category_id} style={styles.row}>
              <TouchableOpacity
                onPress={() => run(setPlanPinned(ym, item.category_id, !item.pinned))}
                hitSlop={8}
                accessibilityLabel={item.pinned ? 'Открепить' : 'Закрепить'}
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
                      item.kind === 'fixed' ? 'фиксированная трата' : '',
                      // the norm's rhythm, when not the default "per day"
                      // a flexible item's amount per its norm rhythm, e.g. "≈ 46 ₾ в неделю"
                      item.kind === 'limit' ? normText(item, ym, currency) : '',
                      shownBudget && item.converted_minor ? `${percentOf(item.converted_minor, shownBudget)} дохода` : '',
                    ].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.amountButton}
                // the amount and currency it was entered in
                onPress={() => setEditingItem({ ...item, label: categoryLabel(item) })}
                accessibilityLabel={`Изменить сумму: ${categoryLabel(item)}`}
              >
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
                  // carried over without an amount: last month's as a muted hint
                  <Text style={[styles.amount, styles.amountEmpty]}>
                    {item.previous_minor ? `было ${formatWithCurrency(item.previous_minor, item.currency)}` : '0'}
                  </Text>
                )}
                {/* tapping the amount edits it too, so the pencil sits with it rather than in RowActions */}
                <PencilIcon color={colors.muted} size={ROW_ICON_SIZE} />
              </TouchableOpacity>
              <RowActions subject={categoryLabel(item)} onDelete={() => run(removePlanItem(ym, item.category_id))} />
            </View>
          ))}
        </View>
      ))}

      <TextInputModal
        visible={budgetOpen}
        title="Сумма к планированию"
        hint={budgetHint}
        // the amount and currency it was entered in
        initialValue={toInputValue(budget?.amount_minor)}
        placeholder="0"
        keyboardType="decimal-pad"
        maxLength={12}
        allowEmpty
        onSubmit={saveBudget}
        onClose={() => setBudgetOpen(false)}
      >
        <CurrencyPicker value={budgetCurrency} onChange={setBudgetCurrency} />
      </TextInputModal>
      <PlanAmountModal ym={ym} target={editingItem} onClose={() => setEditingItem(null)} onSaved={load} />
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
  groupHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.border,
  },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
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
  amountButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingLeft: 8 },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  amountBox: { alignItems: 'flex-end' },
  amountOriginal: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  amountEmpty: { color: colors.muted, fontSize: 14 },
});
