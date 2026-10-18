import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { MonthClose } from '@/db/plans';
import { dayTitle } from '@/shared/lib/dates';
import { currencySymbol, formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { monthWords } from '../model/closeTexts';

type Parts = Array<{ category_id: number; minor: number }>;
type Props = { c: MonthClose | null; visible: boolean; onSave: (parts: Parts) => void; onClose: () => void };

/**
 * "Изменить распределение": each fund's part of what was put aside by hand; the rest goes to savings (🔒 first, then
 * 💰). More than was put aside — can't be saved. "Разложить заново" — as it lays out by itself.
 */
export default function SplitSheet({ c, visible, onSave, onClose }: Props) {
  const [values, setValues] = useState<Record<number, string>>({});
  useEffect(() => {
    if (visible && c?.split) setValues(Object.fromEntries(c.split.funds.map((f) => [f.category_id, toInputValue(f.minor)])));
  }, [visible, c]);
  if (!c || c.put_minor === null || !c.split) return null;
  const parts = c.split.funds.map((f) => ({ category_id: f.category_id, minor: parseAmountOrZero(values[f.category_id] ?? '') }));
  const bad = parts.some((p) => p.minor === null);
  // in the budget's currency when the funds are in it (another — not checked: savings take what is left, 0 at least)
  const same = c.funds.every((f) => f.currency === c.currency);
  const taken = parts.reduce((a, p) => a + (p.minor ?? 0), 0);
  const over = same ? taken - c.put_minor : 0;
  const money = (minor: number, cur: string = c.currency) => formatWithCurrency(minor, cur);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Распределение · ${monthWords(c.ym).nom}`}>
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fact}><Text style={styles.factLabel}>Отложено</Text><Text style={styles.factValue}>{money(c.put_minor)}</Text></View>
        {c.split.funds.map((part) => {
          const f = c.funds.find((x) => x.category_id === part.category_id)!;
          const label = `${f.emoji ?? ''} ${f.name}`.trim();
          return (
            <View key={f.category_id} style={styles.row}>
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>{label}</Text>
                <Text style={styles.note}>{`план ${money(f.planned_minor, f.currency)} · к ${dayTitle(f.due)}`}</Text>
              </View>
              <View style={styles.field}>
                <TextInput
                  style={styles.input} value={values[f.category_id] ?? ''} keyboardType="decimal-pad" maxLength={12} accessibilityLabel={`Отложено в «${label}»`}
                  onChangeText={(v) => setValues((x) => ({ ...x, [f.category_id]: v }))}
                />
                <Text style={styles.cur}>{currencySymbol(f.currency)}</Text>
              </View>
            </View>
          );
        })}
        {same ? (
          <View style={styles.row}>
            <View style={styles.body}><Text style={styles.name}>🔒 Отложено сразу и 💰 Сэкономлено</Text><Text style={styles.note}>в сбережения — остальное</Text></View>
            <Text style={styles.name}>{money(Math.max(0, c.put_minor - taken))}</Text>
          </View>
        ) : null}
        {over > 0 ? <Text style={[formStyles.hint, styles.warn]}>{`Больше, чем отложено, на ${money(over)}`}</Text> : null}
        <SheetActions
          submit={{ title: 'Сохранить', disabled: bad || over > 0, onPress: () => onSave(parts.map((p) => ({ category_id: p.category_id, minor: p.minor ?? 0 }))) }}
          extra={c.auto ? [{ title: 'Разложить заново', onPress: () => onSave(c.auto!.funds) }] : undefined}
          onCancel={onClose}
        />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  factLabel: { fontSize: 15, color: colors.muted },
  factValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  field: { width: 120, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
  cur: { fontSize: 14, color: colors.muted },
  warn: { color: colors.warn },
});
