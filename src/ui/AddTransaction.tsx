import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { incrementCategoryUsage } from '../db/categories';
import { addManualTransaction } from '../db/transactions';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import { formStyles } from './formStyles';
import { parseAmountInput } from './money';
import { AMOUNT_HINT } from './strings';
import Segmented from './Segmented';
import CurrencyButton from './CurrencyButton';
import BottomSheet from './BottomSheet';
import RangeCalendar from './RangeCalendar';
import { DayKey, dayKeyOf, parseDayKey } from './dateRange';
import { MONTHS_GEN } from './format';
import { Currency } from '../db/fx';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTransaction'>;
const KINDS = [['purchase', 'Расход'], ['deposit', 'Пополнение']] as const;
type Kind = typeof KINDS[number][0];

/** "Сегодня, 5 октября" / "Вчера, 4 октября" / "28 сентября" / "28 сентября 2025" */
function dayLabel(day: DayKey, today: DayKey): string {
  const d = parseDayKey(day);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const date = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
  return day === today ? `Сегодня, ${date}` : day === dayKeyOf(yesterday) ? `Вчера, ${date}` : date;
}

/** Manual entry: cash, or anything the bank didn't send an SMS for. */
export default function AddTransaction({ route, navigation }: Props) {
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Kind>('purchase');
  const [currency, setCurrency] = useState<Currency>('GEL');
  const [description, setDescription] = useState('');
  const today = dayKeyOf(new Date());
  const [day, setDay] = useState<DayKey>(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
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
    if (minor === null) { setError(AMOUNT_HINT); return; }
    setSaving(true);
    try {
      // today: now; another day: its noon (no time was chosen)
      const at = day === dayKeyOf(new Date()) ? new Date() : parseDayKey(day);
      if (day !== dayKeyOf(new Date())) at.setHours(12, 0, 0, 0);
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
      <View style={styles.amountRow}>
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
        <CurrencyButton value={currency} onChange={setCurrency} />
      </View>

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
      <View style={styles.dateRow}>
        <Text style={styles.date}>{dayLabel(day, today)}</Text>
        <TouchableOpacity onPress={() => setCalendarOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Изменить дату">
          <Text style={styles.change}>Изменить</Text>
        </TouchableOpacity>
      </View>
      <BottomSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} title="Дата операции">
        <RangeCalendar
          single
          maxDay={today}
          value={{ from: day, to: day }}
          onChange={(r) => { setDay(r.from); setCalendarOpen(false); }}
        />
      </BottomSheet>

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
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { flex: 1, fontSize: 24, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { fontSize: 16, color: colors.text },
  change: { fontSize: 15, color: colors.accent },
  button: { marginTop: 24 },
});
