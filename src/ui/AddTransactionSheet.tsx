import React, { useEffect, useState } from 'react';
import { Controller, useForm, useFormState, useWatch } from 'react-hook-form';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { incrementCategoryUsage, topUpCategoryId } from '../db/categories';
import { addManualTransaction } from '../db/transactions';
import { emitTransactionsChanged } from '../events';
import { CategoryPicker } from '@/entities/category';
import { formStyles } from '@/shared/theme/formStyles';
import { parseAmountInput } from '@/shared/lib/money';
import { AMOUNT_HINT } from '@/shared/lib/strings';
import Segmented from '@/shared/ui/Segmented';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import { Currency } from '../db/fx';
import { colors } from '@/shared/theme/theme';
import { submitForm } from '@/shared/ui/form';
import { toast, toastError } from '@/shared/ui/toast';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import RangeCalendar from '@/shared/ui/RangeCalendar';
import { DayKey, dayKeyOf, parseDayKey } from '@/shared/lib/dateRange';
import { MONTHS_GEN } from '@/shared/lib/dates';
import { showLimitAlert } from '../notifications/notifeeIntegration';

type Props = { visible: boolean; onClose: () => void };
const KINDS = [['purchase', 'Расход'], ['deposit', 'Пополнение']] as const;
type Kind = typeof KINDS[number][0];
type Form = { amount: string; kind: Kind; currency: Currency; description: string; date: DayKey; categoryId: number | null };

const empty = (): Form => ({ amount: '', kind: 'purchase', currency: 'GEL', description: '', date: dayKeyOf(new Date()), categoryId: null });

/** "Сегодня, 5 октября" / "Вчера, 4 октября" / "28 сентября" / "28 сентября 2025" */
function dayLabel(day: DayKey): string {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const d = parseDayKey(day);
  const date = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
  return day === dayKeyOf(now) ? `Сегодня, ${date}` : day === dayKeyOf(yesterday) ? `Вчера, ${date}` : date;
}

/** Manual entry in a sheet (the "+" on the operations): cash, or anything the bank didn't send an SMS for. */
export default function AddTransactionSheet({ visible, onClose }: Props) {
  // a new operation: "Добавить" is always there (it creates one), the amount is checked on submit
  const form = useForm<Form>({ defaultValues: empty() });
  // a clean form each time it opens (no focus: the keyboard opens on a tap)
  useEffect(() => {
    if (visible) form.reset(empty());
  }, [visible, form]);
  const { isSubmitting: saving } = useFormState({ control: form.control });
  // "Изменить": the calendar sheet, with the day being picked
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DayKey | null>(null);
  const today = dayKeyOf(new Date());
  const date = useWatch({ control: form.control, name: 'date' });
  // a deposit goes to "Пополнение счёта" unless another is picked; a purchase can't be in it
  const kind = useWatch({ control: form.control, name: 'kind' });
  useEffect(() => {
    let live = true;
    topUpCategoryId().then((topUp) => {
      if (!live || topUp === null) return;
      const current = form.getValues('categoryId');
      if (kind === 'deposit' && current === null) form.setValue('categoryId', topUp);
      if (kind !== 'deposit' && current === topUp) form.setValue('categoryId', null);
    }).catch((e) => console.error('top-up category failed', e));
    return () => { live = false; };
  }, [kind, form]);


  const save = submitForm(form, async ({ amount, kind, currency, description, date, categoryId }) => {
    const minor = parseAmountInput(amount)!;
    try {
      // today: now; another day: this time of day on it (no time is picked)
      const now = new Date();
      const at = parseDayKey(date);
      at.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
      await addManualTransaction({
        amount_minor: minor,
        currency,
        kind,
        description,
        category_id: categoryId,
        occurred_at: Math.floor(at.getTime() / 1000),
      });
      if (categoryId !== null) await incrementCategoryUsage(categoryId);
      showLimitAlert(categoryId);
      emitTransactionsChanged();
      toast('Операция добавлена');
      onClose();
    } catch (e) {
      console.error('add transaction failed', e);
      toastError('Не удалось сохранить');
    }
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Новая операция" style={styles.root}>
    <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Controller control={form.control} name="kind" render={({ field }) => <Segmented options={KINDS} value={field.value} onChange={field.onChange} />} />

      <Text style={formStyles.label}>Сумма</Text>
      {/* the currency right of the amount, as in the plan */}
      <View style={styles.amountRow}>
      <Controller
        control={form.control}
        name="amount"
        rules={{ validate: (v) => (!v.trim() ? 'Введите сумму' : parseAmountInput(v) !== null || AMOUNT_HINT) }}
        render={({ field }) => (
      <TextInput
        style={[formStyles.input, styles.amount]}
        value={field.value}
        onChangeText={field.onChange}
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        maxLength={12}
      />
        )}
      />
      <Controller control={form.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />
      </View>

      <Text style={formStyles.label}>Описание (необязательно)</Text>
      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
      <TextInput
        style={formStyles.input}
        value={field.value}
        onChangeText={field.onChange}
        placeholder="Например, рынок"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />
        )}
      />

      <Text style={formStyles.label}>Дата</Text>
      <View style={styles.dateRow}>
        <Text style={styles.date}>{dayLabel(date)}</Text>
        <TouchableOpacity
          onPress={() => { setDraft(form.getValues('date')); setCalendarOpen(true); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Изменить дату"
        >
          <Text style={styles.change}>Изменить</Text>
        </TouchableOpacity>
      </View>

      <Controller
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <CategoryPicker selectedId={field.value} onSelect={field.onChange} allowNone deposit={kind === 'deposit'} disabled={saving} />
        )}
      />

      <BottomSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} title="Дата операции">
        <View style={styles.sheet}>
          <RangeCalendar value={draft ? { from: draft, to: draft } : null} onChange={(r) => setDraft(r.from)} single maxDay={today} />
          <SheetActions
            submit={{
              title: 'Выбрать',
              disabled: !draft,
              onPress: () => {
                if (draft) form.setValue('date', draft, { shouldDirty: true });
                setCalendarOpen(false);
              },
            }}
            onCancel={() => setCalendarOpen(false)}
          />
        </View>
      </BottomSheet>
      <SheetActions submit={{ title: 'Добавить', onPress: save, disabled: saving }} onCancel={onClose} />
    </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { maxHeight: '92%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  // stretch: the currency button as tall as the amount field
  amountRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  amount: { flex: 1, fontSize: 24, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { fontSize: 16, color: colors.text },
  change: { fontSize: 15, color: colors.accent },
  sheet: { paddingHorizontal: 16 },
});
