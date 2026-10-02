import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { incrementCategoryUsage } from '../db/categories';
import { addManualTransaction } from '../db/transactions';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import CategoryPicker from './CategoryPicker';
import { parseAmountInput } from './money';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTransaction'>;
type Kind = 'purchase' | 'deposit';
type Day = 'today' | 'yesterday';

/** Manual entry: cash, or anything the bank didn't send an SMS for. */
export default function AddTransaction({ route, navigation }: Props) {
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Kind>('purchase');
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
      <Segmented
        options={[['purchase', 'Расход'], ['deposit', 'Доход']]}
        value={kind}
        onChange={(v) => setKind(v as Kind)}
      />

      <Text style={styles.label}>Сумма, GEL</Text>
      <TextInput
        style={[styles.input, styles.amount]}
        value={amount}
        onChangeText={(v) => { setAmount(v); setError(null); }}
        placeholder="0.00"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        autoFocus
        maxLength={12}
      />

      <Text style={styles.label}>Описание (необязательно)</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Например, рынок"
        placeholderTextColor={colors.muted}
        maxLength={60}
      />

      <Text style={styles.label}>Дата</Text>
      <Segmented
        options={[['today', 'Сегодня'], ['yesterday', 'Вчера']]}
        value={day}
        onChange={(v) => setDay(v as Day)}
      />

      <CategoryPicker
        selectedId={categoryId}
        onSelect={(id) => setCategoryId((cur) => (cur === id ? null : id))}
        newCategory={{ returnSelection: true }}
        disabled={saving}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={save}>
        <Text style={styles.buttonText}>Добавить</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Segmented({ options, value, onChange }: { options: Array<[string, string]>; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map(([key, label]) => (
        <TouchableOpacity key={key} style={[styles.segment, value === key && styles.segmentOn]} onPress={() => onChange(key)}>
          <Text style={[styles.segmentText, value === key && styles.segmentTextOn]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 16, marginBottom: 6 },
  input: {
    fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  amount: { fontSize: 24, fontWeight: '600' },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, padding: 2 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  segmentOn: { backgroundColor: colors.bg },
  segmentText: { fontSize: 15, color: colors.muted },
  segmentTextOn: { color: colors.text, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 12 },
  button: { marginTop: 24, backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
