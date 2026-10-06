import React, { useEffect, useState } from 'react';
import { useFormState, useWatch } from 'react-hook-form';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetScrollView } from '../BottomSheet';
import { Category, categoryLabel, isSavings, listCategories } from '../../db/categories';
import { Currency } from '../../db/fx';
import { addPlanItem, getPlanBudget, lastPlanItem, PlanBudget, planConverter, PlanKind, plannedTotal, setPlanAmount } from '../../db/plans';
import CurrencyButton from '../CurrencyButton';
import { SheetActions } from '../Button';
import Checkbox from '../Checkbox';
import { currencySymbol, formatShort, formatWithCurrency, parseAmountOrZero } from '../money';
import { AMOUNT_HINT } from '../strings';
import { colors } from '../theme';
import { submitForm, useLoadedForm } from '../form';
import { plural } from '../format';
import { toast, toastError } from '../toast';

type Props = {
  ym: string;
  /** the currency typed amounts start in (the screen's) */
  currency: Currency;
  visible: boolean;
  /** categories already in the plan: not offered */
  plannedIds: number[];
  onClose: () => void;
  onSaved: () => void;
};

/** one row of the form: ticked, its amount, its currency (last time's, else the screen's) */
type Item = { checked: boolean; amount: string; currency: Currency };
/** keyed 'c<category id>': a bare number would make the form treat the path as an array index */
type Form = { items: Record<string, Item> };
const keyOf = (id: number) => `c${id}`;

type Row = Category & { last: { limit_minor: number; currency: Currency; kind: PlanKind } | null };

/**
 * "＋" on the plan: every category not in the plan yet with an amount field; several are added at once.
 * Typing an amount ticks the row; a ticked row without an amount takes last time's amount (addPlanItem).
 * Each row has its own currency (last time's, else the screen's); the total (converted) can't go over what is still
 * free of the month's budget.
 */
export default function PlanAddModal({ ym, currency: screenCurrency, visible, plannedIds, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const form = useLoadedForm<Form>(visible && rows ? {
    items: Object.fromEntries(rows.map((r) => [keyOf(r.id), { checked: false, amount: '', currency: r.last?.currency ?? screenCurrency }])),
  } : null, visible);
  const items = useWatch({ control: form.control, name: 'items' }) ?? {};
  const item = (r: Row): Item => items[keyOf(r.id)] ?? { checked: false, amount: '', currency: r.last?.currency ?? screenCurrency };
  const currencyOf = (r: Row): Currency => item(r).currency;
  const setItem = (r: Row, patch: Partial<Item>) => {
    form.setValue(`items.${keyOf(r.id)}`, { ...item(r), ...patch }, { shouldDirty: true });
  };
  const { isSubmitting: saving } = useFormState({ control: form.control });
  // what is still free, in the amount to distribute's currency, and a converter to it
  const [budget, setBudget] = useState<PlanBudget | null>(null);
  const [free, setFree] = useState<number | null>(null);
  const [conv, setConv] = useState<(minor: number, from: Currency, to: Currency) => number | null>(() => () => null);

  useEffect(() => {
    if (!visible) { setRows(null); return; }
    (async () => {
      // "Сбережения" isn't planned: it gets what the budget leaves
      const cats = (await listCategories()).filter((c) => !plannedIds.includes(c.id) && !isSavings(c));
      setRows(await Promise.all(cats.map(async (c) => ({ ...c, last: await lastPlanItem(ym, c.id) }))));
      const b = await getPlanBudget(ym);
      setBudget(b);
      // the unplanned share is not for the plan
      setFree(b === null ? null : Math.max(b.plannable_minor - (await plannedTotal(ym, undefined, b.currency)), 0));
      const c = await planConverter(ym);
      setConv(() => c);
    })().catch((e) => console.error('load plan categories failed', e));
    // plannedIds only matter when opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ym]);

  function toggle(r: Row) {
    setItem(r, { checked: !item(r).checked });
  }

  function setAmount(r: Row, text: string) {
    // typing an amount ticks the row
    setItem(r, text.trim() ? { amount: text, checked: true } : { amount: text });
  }

  /** What each ticked row adds: its own amount in the picked currency, or last time's (what addPlanItem takes) */
  function plannedAmount(r: Row): { minor: number; currency: Currency } | null {
    const text = item(r).amount.trim();
    if (!text) return { minor: r.last?.limit_minor ?? 0, currency: r.last?.currency ?? currencyOf(r) };
    const minor = parseAmountOrZero(text);
    return minor === null ? null : { minor, currency: currencyOf(r) };
  }

  const picked = (rows ?? []).filter((r) => item(r).checked);
  // the ticked rows' total in the budget's currency (or the screen's without it)
  const sumCurrency = budget?.currency ?? screenCurrency;
  const sum = picked.reduce((s, r) => {
    const a = plannedAmount(r);
    return s + (a ? conv(a.minor, a.currency, sumCurrency) ?? 0 : 0);
  }, 0);

  const add = submitForm(form, async () => {
    if (picked.some((r) => plannedAmount(r) === null)) { toastError(AMOUNT_HINT); return; }
    if (free !== null && sum > free) {
      toastError(`Больше бюджета месяца: не распределено ${formatWithCurrency(free, sumCurrency)}`);
      return;
    }
    try {
      for (const r of picked) {
        const text = item(r).amount.trim();
        if (text) await setPlanAmount(ym, r.id, parseAmountOrZero(text)!, r.last?.kind, currencyOf(r));
        else await addPlanItem(ym, r.id);
      }
      toast(picked.length === 1 ? `«${categoryLabel(picked[0])}» добавлена в план` : `Добавлено в план: ${picked.length} ${plural(picked.length, ['категория', 'категории', 'категорий'])}`);
      onSaved();
      onClose();
    } catch (e) {
      console.error('add to plan failed', e);
      toastError('Не удалось добавить');
      onSaved(); // some may have been added
    }
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Добавить в план" style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.caption}>
            {free !== null ? `Не распределено: ${formatWithCurrency(free, sumCurrency)}` : 'Бюджет месяца не задан'}
            {picked.length ? ` · выбрано на ${formatWithCurrency(sum, sumCurrency)}` : ''}
          </Text>
        </View>
        <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
          {(rows ?? []).map((r) => {
            const on = item(r).checked;
            return (
              <View key={r.id} style={styles.row}>
                <TouchableOpacity style={styles.rowMain} onPress={() => toggle(r)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <Checkbox checked={on} size={20} />
                  <Text style={styles.name} numberOfLines={1}>{categoryLabel(r)}</Text>
                </TouchableOpacity>
                {/* the amount and its currency, the same height */}
                <View style={styles.amountRow}>
                <TextInput
                  style={styles.amount}
                  value={item(r).amount}
                  onChangeText={(t) => setAmount(r, t)}
                  // last time's amount: taken when the row is ticked without one
                  placeholder={r.last ? `${formatShort(r.last.limit_minor)}${r.last.currency !== currencyOf(r) ? ` ${currencySymbol(r.last.currency)}` : ''}` : '0'}
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  maxLength={12}
                  accessibilityLabel={`Сумма: ${categoryLabel(r)}`}
                />
                <CurrencyButton value={currencyOf(r)} onChange={(c) => setItem(r, { currency: c })} />
                </View>
              </View>
            );
          })}
          {rows?.length === 0 ? <Text style={styles.empty}>Все категории уже в плане.</Text> : null}
        </SheetScrollView>
        <View style={styles.footer}>
          <Text style={styles.hint}>Без суммы подставится сумма прошлого месяца (серым в поле).</Text>
          <SheetActions
            submit={{ title: picked.length ? `Добавить (${picked.length})` : 'Добавить', onPress: add, disabled: saving || picked.length === 0 }}
            onCancel={onClose}
            style={styles.actions}
          />
        </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '88%', paddingBottom: 0 },
  head: { paddingHorizontal: 16, paddingBottom: 8 },
  caption: { fontSize: 13, color: colors.muted, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  name: { flex: 1, fontSize: 15, color: colors.text },
  amountRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  amount: {
    width: 80, textAlign: 'right', fontSize: 16, color: colors.text, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, fontVariant: ['tabular-nums'],
  },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 16 },
  footer: { padding: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  actions: { marginTop: 8 },
});
