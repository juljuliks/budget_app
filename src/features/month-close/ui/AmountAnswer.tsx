import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { currencySymbol, formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import { toastError } from '@/shared/ui/toast';
import Button from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { font, radius, space, weight } from '@/shared/theme/tokens';

type Props = {
  /** what "Да" puts aside */
  asked: number;
  currency: string;
  /** what was put aside; null — not answered */
  answered: number | null;
  onAnswer: (minor: number, kind: 'yes' | 'other' | 'no') => void;
  /** "Изменить": the question again */
  onReset: () => void;
  /** the field's name for a screen reader ("Отложено в «Отпуск»") */
  label: string;
};

/**
 * "Удалось отложить?" and a fund's contribution: "Да, 50 ₾" / "Другая сумма" (a field and "Готово") / "Нет". Answered:
 * "✓ Отложено 50 ₾" or "✕ Не отложено", and "Изменить".
 */
export default function AmountAnswer({ asked, currency, answered, onAnswer, onReset, label }: Props) {
  const [other, setOther] = useState<string | null>(null);
  const money = (minor: number) => formatWithCurrency(minor, currency);

  if (answered !== null) {
    return (
      <View style={styles.row}>
        <Text style={[styles.done, answered === 0 && styles.none]}>
          {answered > 0 ? `✓ Отложено ${money(answered)}` : '✕ Не отложено'}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setOther(null);
            onReset();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Изменить: ${label}`}
        >
          <Text style={styles.link}>Изменить</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (other !== null) {
    const done = () => {
      const minor = parseAmountOrZero(other);
      if (minor === null) {
        toastError('Введите сумму');
        return;
      }
      onAnswer(minor, minor === 0 ? 'no' : 'other');
    };
    return (
      <View style={styles.row}>
        <View style={styles.field}>
          <TextInput
            style={styles.input}
            value={other}
            onChangeText={setOther}
            keyboardType="decimal-pad"
            maxLength={12}
            autoFocus
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            accessibilityLabel={label}
          />
          <Text style={styles.cur}>{currencySymbol(currency)}</Text>
        </View>
        <Button title="Готово" onPress={done} size="small" />
      </View>
    );
  }
  return (
    <View style={styles.buttons}>
      <Button title={`Да, ${money(asked)}`} onPress={() => onAnswer(asked, 'yes')} size="small" />
      <Button title="Другая сумма" onPress={() => setOther('')} variant="secondary" size="small" />
      <Button title="Нет" onPress={() => onAnswer(0, 'no')} variant="cancel" size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[8], justifyContent: 'space-between' },
  done: { fontSize: font.body, fontWeight: weight.medium, color: colors.income, flexShrink: 1 },
  none: { color: colors.muted },
  link: { fontSize: font.body, color: colors.accent },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: space[12],
  },
  input: { flex: 1, fontSize: font.input, color: colors.text, paddingVertical: space[8] },
  cur: { fontSize: font.body, color: colors.muted },
});
