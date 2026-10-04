import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { incrementCategoryUsage } from '../db/categories';
import { addManualTransaction } from '../db/transactions';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import { formStyles } from './formStyles';
import { parseAmountInput } from './money';
import Segmented from './Segmented';
import CurrencyPicker from './CurrencyPicker';
import { Currency } from '../db/fx';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTransaction'>;
const KINDS = [['purchase', 'Расход'], ['deposit', 'Доход']] as const;
const DAYS = [['today', 'Сегодня'], ['yesterday', 'Вчера']] as const;
type Kind = typeof KINDS[number][0];
type Day = typeof DAYS[number][0];

/** Manual entry: cash, or anything the bank didn't send an SMS for. */
export default function AddTransaction({ route, navigation }: Props) {
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Kind>('purchase');
  const [currency, setCurrency] = useState<Currency>('GEL');
  const [description, setDescription] = useState('');
  const [day, setDay] = useState<Day>('today');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // a category just created via "+ Новая категория" comes back selected
  const selectCategoryId = route.params?.selectCategoryId;
  useEffect(() => {
    if (selectCategoryId !== undefined) setCategoryId(selectCategoryId);
  }, [selectCategoryId]);

  async function save() {
    const minor = parseAmountInput(amount);
    if (minor === null) { setError('Введите сумму, например 12.50'); return; }
    setSaving(true);
    try {
      const at = new Date();
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
      emitTransactionsChanged();
      navigation.goBack();
    } catch (e) {
      console.error('add transaction failed', e);
      setError('Не удалось сохранить');
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Segmented options={KINDS} value={kind} onChange={setKind} />

      <Text style={formStyles.label}>Сумма</Text>
      <CurrencyPicker value={currency} onChange={setCurrency} style={styles.currency} />
      <TextInput
        style={[formStyles.input, styles.amount]}
        value={amount}
        onChangeText={(v) => { setAmount(v); setError(null); }}
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        autoFocus
        maxLength={12}
      />

      <Text style={formStyles.label}>Описание (необязательно)</Text>
      <TextInput
        style={formStyles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Например, рынок"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />

      <Text style={formStyles.label}>Дата</Text>
      <Segmented options={DAYS} value={day} onChange={setDay} />

      <CategoryPicker
        selectedId={categoryId}
        onSelect={setCategoryId}
        allowNone
        newCategory={{ returnSelection: true }}
        disabled={saving}
      />

      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      <Button title="Добавить" disabled={saving} onPress={save} style={styles.button} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  amount: { fontSize: 24, fontWeight: '600' },
  currency: { marginBottom: 8 },
  button: { marginTop: 24 },
});
