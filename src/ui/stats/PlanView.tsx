import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel } from '../../db/categories';
import {
  addPlanItem, BUDGET_CURRENCY, listPlan, PlanItem, removePlanItem, setPlanAmount, setPlanPinned,
} from '../../db/plans';
import CategoryPicker from '../CategoryPicker';
import { PinIcon } from '../icons';
import { formatMoney, parseAmountInput, toInputValue } from '../money';
import { colors } from '../theme';

/**
 * Plan for one month. A new month starts from the previous month's items:
 * pinned ones keep their amount, the others need a new amount (last month's is shown as a hint).
 */
export default function PlanView({ ym }: { ym: string }) {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [drafts, setDrafts] = useState<Map<number, string>>(new Map());

  const load = useCallback(() => {
    listPlan(ym)
      .then((plan) => {
        setItems(plan);
        setDrafts(new Map(plan.map((p) => [p.category_id, toInputValue(p.limit_minor)])));
      })
      .catch((e) => console.error('load plan failed', e));
  }, [ym]);

  useFocusEffect(load);
  useEffect(load, [load]);

  const total = useMemo(() => (items ?? []).reduce((sum, i) => sum + i.limit_minor, 0), [items]);

  async function commitAmount(item: PlanItem) {
    const text = (drafts.get(item.category_id) ?? '').trim();
    const minor = text === '' ? 0 : parseAmountInput(text);
    if (minor === null) {
      // invalid input: restore the saved value
      setDrafts((d) => new Map(d).set(item.category_id, toInputValue(item.limit_minor)));
      return;
    }
    if (minor === item.limit_minor) return;
    await setPlanAmount(ym, item.category_id, minor);
    load();
  }

  async function run(action: Promise<unknown>) {
    try { await action; } catch (e) { console.error('plan update failed', e); }
    load();
  }

  if (!items) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.totalBox}>
        <Text style={styles.caption}>Запланировано</Text>
        <Text style={styles.total}>{formatMoney(total, { compact: true })} {BUDGET_CURRENCY}</Text>
        <Text style={styles.caption}>📌 — пункт перейдёт в следующий месяц вместе с суммой</Text>
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
          <Text style={styles.name} numberOfLines={1}>{categoryLabel(item)}</Text>
          <TextInput
            style={styles.input}
            value={drafts.get(item.category_id) ?? ''}
            onChangeText={(v) => setDrafts((d) => new Map(d).set(item.category_id, v))}
            onEndEditing={() => commitAmount(item)}
            onSubmitEditing={() => commitAmount(item)}
            // last month's amount as a hint for items that came over without one
            placeholder={item.previous_minor ? toInputValue(item.previous_minor) : '0'}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            maxLength={10}
          />
          <TouchableOpacity onPress={() => run(removePlanItem(ym, item.category_id))} hitSlop={8} accessibilityLabel="Убрать из плана">
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <CategoryPicker
        title="Добавить в план"
        onSelect={(id) => run(addPlanItem(ym, id))}
        excludeIds={items.map((i) => i.category_id)}
        // a category created from here goes straight into this month's plan
        newCategory={{ planYm: ym }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  totalBox: { alignItems: 'center', marginBottom: 12 },
  total: { fontSize: 28, fontWeight: '700', color: colors.text, marginVertical: 4 },
  caption: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  pin: { paddingRight: 8 },
  name: { flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  input: {
    width: 100, fontSize: 16, color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'],
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  remove: { fontSize: 16, color: colors.muted, paddingLeft: 12 },
});
