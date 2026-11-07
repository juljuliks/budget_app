import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { currentYm, fundContribution, getFund, monthsBetween } from '@/db/plans';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { dayTitle } from '@/shared/lib/dates';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import DateField from '@/shared/ui/DateField';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { saveCategoryFund } from '../model/commands';
import { FUND_SWITCH, months, SAVE_FUND } from '../texts';

type Draft = { target: string; currency: Currency; due: string | null; start: string };

type Props = {
  /** null — closed */
  categoryId: number | null;
  /** "🏖 Отпуск" */
  label: string;
  onClose: () => void;
  /** saved (the category is a fund now) */
  onSaved: () => void;
};

/**
 * «Настроить» of a fund (its category's page, «В плане» — «Копилка»): how much by when and what was saved before; the
 * contribution a month by them (the fund's own sum: what the plan gives it is the plan's). Its open fund comes back.
 */
export default function FundSetupSheet({ categoryId, label, onClose, onSaved }: Props) {
  const shown = useDisplayCurrency();
  const [draft, setDraft] = useState<Draft>({ target: '', currency: shown, due: null, start: '' });
  const [estimate, setEstimate] = useState<number | null>(null);
  useEffect(() => {
    if (categoryId === null) return;
    getFund(categoryId).then((f) => {
      const open = f && !f.closed_ym ? f : null;
      setDraft(open ? { target: toInputValue(open.target_minor), currency: open.currency, due: open.due, start: open.start_minor ? toInputValue(open.start_minor) : '' }
        : { target: '', currency: shown, due: null, start: '' });
    }).catch((e) => console.error('load fund failed', e));
  }, [categoryId, shown]);
  const target = parseAmountOrZero(draft.target);
  const start = parseAmountOrZero(draft.start) ?? 0;
  const ym = currentYm();
  useEffect(() => {
    if (categoryId === null || !target || !draft.due) { setEstimate(null); return; }
    let live = true;
    fundContribution(ym, categoryId, { target_minor: target, currency: draft.currency, due: draft.due, start_minor: start })
      .then((c) => { if (live) setEstimate(c); }).catch((e) => console.error('fund contribution failed', e));
    return () => { live = false; };
  }, [target, start, draft.due, draft.currency, categoryId, ym]);
  const count = draft.due ? monthsBetween(ym, draft.due.slice(0, 7)) : 0;
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const save = () => {
    if (categoryId === null || !target || !draft.due) return;
    saveCategoryFund(categoryId, label, { target_minor: target, currency: draft.currency, due: draft.due, start_minor: start }, onSaved);
  };
  return (
    <BottomSheet visible={categoryId !== null} onClose={onClose} title={FUND_SWITCH}>
      <SheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.category}>{label}</Text>
        <Text style={formStyles.label}>Сколько накопить</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={[formStyles.input, styles.amount]} value={draft.target} onChangeText={(t) => set({ target: t })} placeholder="0.00"
            placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={12} accessibilityLabel="Сколько накопить"
          />
          <CurrencyButton value={draft.currency} onChange={(c) => set({ currency: c })} />
        </View>
        <DateField
          label="К какой дате" value={draft.due} format={dayTitle} suffix={draft.due && count ? ` · через ${months(count)}` : null}
          sheetTitle="К какой дате накопить" minDay={dayKeyOf(new Date())} onChange={(d) => set({ due: d })}
        />
        <Text style={formStyles.label}>Уже отложено (необязательно)</Text>
        <TextInput
          style={formStyles.input} value={draft.start} onChangeText={(t) => set({ start: t })} placeholder="0.00"
          placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={12} accessibilityLabel="Уже отложено"
        />
        <View style={styles.plate}>
          {estimate !== null ? <Text style={styles.plateTitle}>{`${formatWithCurrency(estimate, draft.currency)} в месяц · ${months(count)}`}</Text>
            : <Text style={[styles.plateTitle, styles.muted]}>{draft.due ? 'Введите, сколько накопить' : 'Выберите дату — посчитаем взнос в месяц'}</Text>}
        </View>
        <SheetActions submit={{ title: SAVE_FUND, onPress: save, disabled: !target || !draft.due }} />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  category: { fontSize: 15, color: colors.muted },
  amountRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  amount: { flex: 1 },
  plate: { backgroundColor: colors.fundBg, borderRadius: 12, padding: 12, marginTop: 14 },
  plateTitle: { fontSize: 15, fontWeight: '600', color: colors.fundText },
  muted: { color: colors.muted },
});
