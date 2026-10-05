import React, { useEffect, useState } from 'react';
import { Controller, useForm, useFormState, useWatch } from 'react-hook-form';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { incrementCategoryUsage } from '../db/categories';
import { addManualTransaction } from '../db/transactions';
import { emitTransactionsChanged } from '../events';
import CategoryPicker from './CategoryPicker';
import { formStyles } from './formStyles';
import { parseAmountInput } from './money';
import { AMOUNT_HINT } from './strings';
import Segmented from './Segmented';
import CurrencyPicker from './CurrencyPicker';
import { Currency } from '../db/fx';
import { colors } from './theme';
import { submitForm } from './form';
import { toast, toastError } from './toast';
import BottomSheet, { SheetScrollView } from './BottomSheet';
import { SheetActions } from './Button';
import RangeCalendar from './RangeCalendar';
import { DayKey, dayKeyOf, parseDayKey, shortRange } from './dateRange';
import { showLimitAlert } from '../notifications/notifeeIntegration';

type Props = { visible: boolean; onClose: () => void };
const KINDS = [['purchase', 'Расход'], ['deposit', 'Пополнение']] as const;
type Kind = typeof KINDS[number][0];
/** 'other': the day picked in the calendar (`date`) */
type Day = 'today' | 'yesterday' | 'other';
type Form = { amount: string; kind: Kind; currency: Currency; description: string; day: Day; date: DayKey | null; categoryId: number | null };

const EMPTY: Form = { amount: '', kind: 'purchase', currency: 'GEL', description: '', day: 'today', date: null, categoryId: null };

/** Manual entry in a sheet (the "+" on the operations): cash, or anything the bank didn't send an SMS for. */
export default function AddTransactionSheet({ visible, onClose }: Props) {
  // a new operation: "Добавить" is always there (it creates one), the amount is checked on submit
  const form = useForm<Form>({ defaultValues: EMPTY });
  // a clean form each time it opens (no focus: the keyboard opens on a tap)
  useEffect(() => {
    if (visible) form.reset(EMPTY);
  }, [visible, form]);
  const { isSubmitting: saving } = useFormState({ control: form.control });
  // "Другая дата": the calendar sheet, with the day being picked
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DayKey | null>(null);
  const today = dayKeyOf(new Date());
  const date = useWatch({ control: form.control, name: 'date' });


  const save = submitForm(form, async ({ amount, kind, currency, description, day, date, categoryId }) => {
    const minor = parseAmountInput(amount)!;
    try {
      // today / yesterday at this time; another day at noon
      const at = day === 'other' && date ? parseDayKey(date) : new Date();
      if (day === 'other' && date) at.setHours(12, 0, 0, 0);
      if (day === 'yesterday') at.setDate(at.getDate() - 1);
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
      <Controller control={form.control} name="currency" render={({ field }) => <CurrencyPicker value={field.value} onChange={field.onChange} style={styles.currency} />} />
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
      <Controller
        control={form.control}
        name="day"
        render={({ field }) => {
          // the third option names the picked day once there is one: "12 сен"
          const options = [['today', 'Сегодня'], ['yesterday', 'Вчера'], ['other', field.value === 'other' && date ? shortRange({ from: date, to: date }) : 'Другая дата']] as const;
          return (
            <Segmented
              options={options}
              value={field.value}
              onChange={(d) => {
                if (d !== 'other') { field.onChange(d); return; }
                setDraft(form.getValues('date'));
                setCalendarOpen(true);
              }}
            />
          );
        }}
      />

      <Controller
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <CategoryPicker selectedId={field.value} onSelect={field.onChange} allowNone disabled={saving} />
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
                form.setValue('date', draft, { shouldDirty: true });
                form.setValue('day', 'other', { shouldDirty: true });
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
  amount: { fontSize: 24, fontWeight: '600' },
  currency: { marginBottom: 8 },
  sheet: { paddingHorizontal: 16 },
});
