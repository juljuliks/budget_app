import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel } from '../../db/categories';
import {
  addPlanItem, BUDGET_CURRENCY, getPlanBudget, listPlan, monthIncome, OverBudgetError, PlanItem, removePlanItem,
  setPlanAmount, setPlanBudget, setPlanPinned,
} from '../../db/plans';
import CategoryPicker from '../CategoryPicker';
import { PencilIcon, PinIcon } from '../icons';
import Meter from '../Meter';
import { formatShort, formatWithCurrency, parseAmountInput, toInputValue } from '../money';
import RowActions, { ROW_ICON_SIZE } from '../RowActions';
import TextInputModal from '../TextInputModal';
import { chart, colors } from '../theme';

const money = (minor: number) => formatWithCurrency(minor, BUDGET_CURRENCY);

/** Share of the amount to distribute, "35%"; "<1%" for tiny non-zero amounts. */
function percentOf(part: number, whole: number): string {
  if (part <= 0 || whole <= 0) return '';
  const p = Math.round((part / whole) * 100);
  return p === 0 ? '<1%' : `${p}%`;
}

/** '' = 0; null = not an amount. */
function parseOrZero(text: string): number | null {
  return text.trim() === '' ? 0 : parseAmountInput(text);
}

/** What the amount modal edits: the month's amount to distribute or one plan item. */
type Editing = { kind: 'budget' } | { kind: 'item'; item: PlanItem };

/**
 * Plan for one month. A new month starts from the previous month's items:
 * pinned ones keep their amount, the others need a new amount (last month's is shown as a hint).
 * With an amount to distribute set, the plan can't exceed it; the rest is shown as "Свободно".
 */
export default function PlanView({ ym }: { ym: string }) {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  // amount to distribute (e.g. salary); null = not set (shown as 0, no cap)
  const [budget, setBudget] = useState<number | null>(null);
  const [income, setIncome] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = useCallback(() => {
    Promise.all([listPlan(ym), getPlanBudget(ym), monthIncome(ym)])
      .then(([plan, b, inc]) => { setItems(plan); setBudget(b); setIncome(inc); })
      .catch((e) => console.error('load plan failed', e));
  }, [ym]);

  useFocusEffect(load);
  useEffect(load, [load]);

  const total = useMemo(() => (items ?? []).reduce((sum, i) => sum + i.limit_minor, 0), [items]);
  const free = budget === null ? null : budget - total;

  /** Saves the modal's value; returns an error to show in the modal, or null. */
  async function save(text: string): Promise<string | null> {
    if (!editing) return null;
    const minor = parseOrZero(text);
    if (minor === null) return 'Введите сумму, например 1500 или 12.50';
    try {
      if (editing.kind === 'budget') {
        await setPlanBudget(ym, minor === 0 ? null : minor);
      } else {
        await setPlanAmount(ym, editing.item.category_id, minor);
      }
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      load();
      return editing.kind === 'budget'
        ? `По категориям уже запланировано ${money(e.planned_minor)} — сумма не может быть меньше.`
        : `Больше суммы к планированию. Свободно для этой категории: ${money(Math.max((free ?? 0) + editing.item.limit_minor, 0))}.`;
    }
    load();
    return null;
  }

  async function run(action: Promise<unknown>) {
    try { await action; } catch (e) { console.error('plan update failed', e); }
    load();
  }

  if (!items) return <View style={styles.center}><ActivityIndicator /></View>;

  const modal = editing?.kind === 'budget'
    ? {
      title: 'Сумма к планированию',
      initial: toInputValue(budget),
      hint: [
        total > 0 ? `Уже запланировано: ${money(total)}` : '',
        income > 0 ? `Поступления за месяц: ${money(income)}` : '',
      ].filter(Boolean).join('\n') || 'Например, зарплата. План не сможет её превысить.',
    }
    : editing?.kind === 'item'
      ? {
        title: categoryLabel(editing.item),
        initial: toInputValue(editing.item.limit_minor),
        hint: [
          free !== null ? `Свободно: ${money(Math.max(free + editing.item.limit_minor, 0))}` : '',
          editing.item.previous_minor ? `В прошлом месяце: ${money(editing.item.previous_minor)}` : '',
        ].filter(Boolean).join('\n'),
      }
      : null;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.budgetBox}>
        <Text style={styles.caption}>Сумма к планированию</Text>
        <TouchableOpacity
          style={styles.budgetRow}
          onPress={() => setEditing({ kind: 'budget' })}
          accessibilityLabel="Изменить сумму к планированию"
        >
          <Text style={styles.budgetValue}>{money(budget ?? 0)}</Text>
          <PencilIcon color={colors.accent} size={20} />
        </TouchableOpacity>

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Запланировано</Text>
            <Text style={styles.summaryValue}>{money(total)}</Text>
            {budget ? <Text style={styles.caption}>{percentOf(total, budget) || '0%'}</Text> : null}
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.caption}>Свободно</Text>
            <Text style={[styles.summaryValue, free !== null && styles.freeValue]}>{free === null ? '—' : money(free)}</Text>
            {budget ? <Text style={styles.caption}>{percentOf(free ?? 0, budget) || '0%'}</Text> : null}
          </View>
        </View>
        {budget ? (
          // share of the amount already distributed: not a spent/limit meter, so no warning colors
          <Meter ratio={total / budget} color={chart.meterFill} />
        ) : (
          <Text style={styles.caption}>Укажите сумму (например, зарплату): план не сможет её превысить, а у категорий появятся доли в %</Text>
        )}
        <Text style={[styles.caption, styles.pinNote]}>📌 — пункт перейдёт в следующий месяц вместе с суммой</Text>
      </View>

      {items.length === 0 ? <Text style={styles.hint}>План пуст. Добавьте категории, на которые хотите выделить сумму.</Text> : null}

      {items.map((item) => (
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
            <Text style={styles.name} numberOfLines={1}>{categoryLabel(item)}</Text>
            {budget && item.limit_minor ? <Text style={styles.percent}>{percentOf(item.limit_minor, budget)} суммы</Text> : null}
          </View>
          <TouchableOpacity
            style={styles.amountButton}
            onPress={() => setEditing({ kind: 'item', item })}
            accessibilityLabel={`Изменить сумму: ${categoryLabel(item)}`}
          >
            {item.limit_minor ? (
              <Text style={styles.amount}>{formatShort(item.limit_minor)}</Text>
            ) : (
              // carried over without an amount: last month's as a muted hint
              <Text style={[styles.amount, styles.amountEmpty]}>
                {item.previous_minor ? `было ${formatShort(item.previous_minor)}` : '0'}
              </Text>
            )}
            {/* tapping the amount edits it too, so the pencil sits with it rather than in RowActions */}
            <PencilIcon color={colors.muted} size={ROW_ICON_SIZE} />
          </TouchableOpacity>
          <RowActions subject={categoryLabel(item)} onDelete={() => run(removePlanItem(ym, item.category_id))} />
        </View>
      ))}

      <CategoryPicker
        title="Добавить в план"
        onSelect={(id) => { if (id !== null) run(addPlanItem(ym, id)); }}
        excludeIds={items.map((i) => i.category_id)}
        // a category created from here goes straight into this month's plan
        newCategory={{ planYm: ym }}
      />

      <TextInputModal
        visible={modal !== null}
        title={modal?.title ?? ''}
        hint={modal?.hint}
        initialValue={modal?.initial ?? ''}
        placeholder="0"
        keyboardType="decimal-pad"
        maxLength={12}
        allowEmpty
        onSubmit={save}
        onClose={() => setEditing(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
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
  amountEmpty: { color: colors.muted, fontSize: 14 },
});
