import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Category, listCategories } from '../db/categories';
import { BUDGET_CURRENCY, listBudgets, setBudget } from '../db/budgets';
import { formatMoney, parseAmountInput, toInputValue } from './money';
import { colors } from './theme';

/** Monthly planned amount per category. The same plan applies to every month. */
export default function PlannerScreen() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [saved, setSaved] = useState<Map<number, number>>(new Map());
  const [drafts, setDrafts] = useState<Map<number, string>>(new Map());

  useFocusEffect(useCallback(() => {
    Promise.all([listCategories(), listBudgets()])
      .then(([cats, budgets]) => {
        setCategories(cats);
        const m = new Map(budgets.map((b) => [b.category_id, b.limit_minor]));
        setSaved(m);
        setDrafts(new Map(cats.map((c) => [c.id, toInputValue(m.get(c.id))])));
      })
      .catch((e) => console.error('load planner failed', e));
  }, []));

  const total = useMemo(() => Array.from(saved.values()).reduce((a, b) => a + b, 0), [saved]);

  async function commit(categoryId: number) {
    const text = drafts.get(categoryId) ?? '';
    const minor = text.trim() === '' ? null : parseAmountInput(text);
    if (text.trim() !== '' && minor === null) {
      // invalid input: restore the saved value
      setDrafts((d) => new Map(d).set(categoryId, toInputValue(saved.get(categoryId))));
      return;
    }
    if (minor === (saved.get(categoryId) ?? null)) return;
    try {
      await setBudget(categoryId, minor);
      setSaved((s) => {
        const next = new Map(s);
        if (minor) next.set(categoryId, minor); else next.delete(categoryId);
        return next;
      });
      setDrafts((d) => new Map(d).set(categoryId, toInputValue(minor)));
    } catch (e) {
      console.error('save budget failed', e);
    }
  }

  if (!categories) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.totalBox}>
          <Text style={styles.caption}>Запланировано на месяц</Text>
          <Text style={styles.total}>{formatMoney(total, { compact: true })} {BUDGET_CURRENCY}</Text>
          <Text style={styles.caption}>Сумма действует каждый месяц, пока вы её не измените</Text>
        </View>
        {categories.map((c) => (
          <View key={c.id} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
            <TextInput
              style={styles.input}
              value={drafts.get(c.id) ?? ''}
              onChangeText={(v) => setDrafts((d) => new Map(d).set(c.id, v))}
              onEndEditing={() => commit(c.id)}
              onSubmitEditing={() => commit(c.id)}
              placeholder="—"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              maxLength={10}
            />
            <Text style={styles.currency}>{BUDGET_CURRENCY}</Text>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  totalBox: { alignItems: 'center', marginBottom: 16 },
  total: { fontSize: 28, fontWeight: '700', color: colors.text, marginVertical: 4 },
  caption: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  name: { flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  input: {
    width: 110, fontSize: 16, color: colors.text, textAlign: 'right', fontVariant: ['tabular-nums'],
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  currency: { width: 36, marginLeft: 6, fontSize: 13, color: colors.muted },
});
