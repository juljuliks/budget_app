import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Category, categoryLabel, listCategories } from '../../db/categories';
import { addPlanItem, BUDGET_CURRENCY, getPlanBudget, lastPlanItem, PlanKind, plannedTotal, setPlanAmount } from '../../db/plans';
import Button from '../Button';
import Checkbox from '../Checkbox';
import { formatShort, formatWithCurrency, parseAmountOrZero } from '../money';
import { colors } from '../theme';

type Props = {
  ym: string;
  visible: boolean;
  /** categories already in the plan: not offered */
  plannedIds: number[];
  onClose: () => void;
  onSaved: () => void;
};

type Row = Category & { last: { limit_minor: number; kind: PlanKind } | null };

const money = (minor: number) => formatWithCurrency(minor, BUDGET_CURRENCY);

/**
 * "＋" on the plan: every category not in the plan yet with an amount field; several are added at once.
 * Typing an amount ticks the row; a ticked row without an amount takes last time's amount (addPlanItem).
 * The total can't go over what is still free of the amount to distribute.
 */
export default function PlanAddModal({ ym, visible, plannedIds, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [free, setFree] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setChecked(new Set());
    setAmounts({});
    setError(null);
    setSaving(false);
    (async () => {
      const cats = (await listCategories()).filter((c) => !plannedIds.includes(c.id));
      setRows(await Promise.all(cats.map(async (c) => ({ ...c, last: await lastPlanItem(ym, c.id) }))));
      const budget = await getPlanBudget(ym);
      setFree(budget === null ? null : Math.max(budget - (await plannedTotal(ym)), 0));
    })().catch((e) => console.error('load plan categories failed', e));
    // plannedIds only matter when opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ym]);

  function toggle(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setError(null);
  }

  function setAmount(id: number, text: string) {
    setAmounts((prev) => ({ ...prev, [id]: text }));
    if (text.trim()) setChecked((prev) => new Set(prev).add(id));
    setError(null);
  }

  /** What each ticked row adds: its own amount, or last time's (that's what addPlanItem will take) */
  function plannedAmount(r: Row): number | null {
    const text = amounts[r.id]?.trim();
    return text ? parseAmountOrZero(text) : r.last?.limit_minor ?? 0;
  }

  const picked = rows.filter((r) => checked.has(r.id));
  const sum = picked.reduce((s, r) => s + (plannedAmount(r) ?? 0), 0);

  async function add() {
    if (picked.some((r) => plannedAmount(r) === null)) { setError('Введите сумму, например 1500 или 12.50'); return; }
    if (free !== null && sum > free) { setError(`Больше суммы к планированию: свободно ${money(free)}.`); return; }
    setSaving(true);
    try {
      for (const r of picked) {
        const text = amounts[r.id]?.trim();
        if (text) await setPlanAmount(ym, r.id, parseAmountOrZero(text)!, r.last?.kind);
        else await addPlanItem(ym, r.id);
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error('add to plan failed', e);
      setError('Не удалось добавить');
      setSaving(false);
      onSaved(); // some may have been added
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <KeyboardAvoidingView behavior="height" style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>Добавить в план</Text>
          <Text style={styles.caption}>
            {free !== null ? `Свободно: ${money(free)}` : 'Сумма к планированию не задана'}
            {picked.length ? ` · выбрано на ${money(sum)}` : ''}
          </Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
          {rows.map((r) => {
            const on = checked.has(r.id);
            return (
              <View key={r.id} style={styles.row}>
                <TouchableOpacity style={styles.rowMain} onPress={() => toggle(r.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <Checkbox checked={on} size={20} />
                  <Text style={styles.name} numberOfLines={1}>{categoryLabel(r)}</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.amount}
                  value={amounts[r.id] ?? ''}
                  onChangeText={(t) => setAmount(r.id, t)}
                  // last time's amount: taken when the row is ticked without one
                  placeholder={r.last ? formatShort(r.last.limit_minor) : '0'}
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  maxLength={12}
                  accessibilityLabel={`Сумма: ${categoryLabel(r)}`}
                />
              </View>
            );
          })}
          {rows.length === 0 ? <Text style={styles.empty}>Все категории уже в плане.</Text> : null}
        </ScrollView>
        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : (
            <Text style={styles.hint}>Без суммы подставится сумма из прошлого плана (серым в поле).</Text>
          )}
          <Button title={picked.length ? `Добавить (${picked.length})` : 'Добавить'} onPress={add} disabled={saving || picked.length === 0} />
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  head: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, color: colors.muted, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  name: { flex: 1, fontSize: 15, color: colors.text },
  amount: {
    width: 96, textAlign: 'right', fontSize: 16, color: colors.text, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, fontVariant: ['tabular-nums'],
  },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 16 },
  footer: { padding: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  error: { fontSize: 13, color: colors.danger, marginBottom: 8 },
  cancel: { alignItems: 'center', paddingTop: 12 },
  cancelText: { fontSize: 16, color: colors.muted },
});
