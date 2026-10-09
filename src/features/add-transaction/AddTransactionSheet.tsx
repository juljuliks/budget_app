import React from 'react';
import { Controller } from 'react-hook-form';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CategoryPicker } from '@/entities/category';
import { parseAmountInput } from '@/shared/lib/money';
import { AMOUNT_HINT } from '@/shared/lib/strings';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import Segmented from '@/shared/ui/Segmented';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { KINDS, useAddForm } from './model/useAddForm';
import DateField from './ui/DateField';

/** Manual entry in a sheet (the "+" on the operations): cash, or anything the bank didn't send an SMS for. */
export default function AddTransactionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { form, saving, date, kind, save } = useAddForm(visible, onClose);
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

      <DateField value={date} onChange={(d) => form.setValue('date', d, { shouldDirty: true })} />

      <Controller
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <CategoryPicker selectedId={field.value} onSelect={field.onChange} allowNone deposit={kind === 'deposit'} disabled={saving} />
        )}
      />
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
});
