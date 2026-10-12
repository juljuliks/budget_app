import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SPLIT_COLORS } from '@/entities/transaction';
import { currencySymbol, formatMoneyWithCurrency } from '@/shared/lib/money';
import { CloseIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';

type Props = {
  index: number;
  label: string;
  currency: string;
  /** a part: its amount as typed; the own category (no `text`): what's left */
  text?: string;
  rest?: number;
  onText?: (text: string) => void;
  onPickCategory: () => void;
  onRemove?: () => void;
};

/** One category of a split being edited: its color, its category (a tap changes it), its amount; ✕ removes a part. */
export default function SplitRow({ index, label, currency, text, rest, onText, onPickCategory, onRemove }: Props) {
  const own = text === undefined;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: SPLIT_COLORS[index % SPLIT_COLORS.length] }]} />
      <View style={styles.name}>
        <TouchableOpacity style={styles.chip} onPress={onPickCategory} accessibilityLabel={`Категория: ${label}`}>
          <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
        {own ? <Text style={styles.hint}>остальное</Text> : null}
      </View>
      {own ? (
        <Text style={[styles.rest, (rest ?? 0) <= 0 && styles.danger]}>{formatMoneyWithCurrency(rest ?? 0, currency)}</Text>
      ) : (
        <View style={styles.input}>
          <TextInput
            value={text}
            onChangeText={onText}
            keyboardType="decimal-pad"
            placeholder="0"
            style={styles.inputText}
            accessibilityLabel={`Сумма: ${label}`}
            autoFocus={text === ''}
          />
          <Text style={styles.symbol}>{currencySymbol(currency)}</Text>
        </View>
      )}
      {onRemove ? (
        <TouchableOpacity style={styles.remove} onPress={onRemove} accessibilityLabel={`Убрать: ${label}`}>
          <CloseIcon color={colors.muted} size={18} />
        </TouchableOpacity>
      ) : <View style={styles.remove} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, alignItems: 'flex-start', gap: 3 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface, maxWidth: '100%' },
  chipText: { fontSize: 15, color: colors.text },
  hint: { fontSize: 13, color: colors.muted, paddingLeft: 4 },
  rest: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  danger: { color: colors.danger },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.accent,
    borderRadius: 8, paddingHorizontal: 10,
  },
  inputText: { fontSize: 16, color: colors.text, minWidth: 48, textAlign: 'right', paddingVertical: 6, fontVariant: ['tabular-nums'] },
  symbol: { fontSize: 16, color: colors.text },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
