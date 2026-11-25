import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SPLIT_COLORS } from '@/entities/transaction';
import { currencySymbol, formatMoneyWithCurrency } from '@/shared/lib/money';
import { CloseIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { font, radius, space } from '@/shared/theme/tokens';
import Chip from '@/shared/ui/Chip';

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
        <Chip label={label} onPress={onPickCategory} accessibilityLabel={`Категория: ${label}`} />
        {own ? <Text style={styles.hint}>остальное</Text> : null}
      </View>
      {own ? (
        <Text style={[styles.rest, (rest ?? 0) <= 0 && styles.danger]}>
          {formatMoneyWithCurrency(rest ?? 0, currency)}
        </Text>
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
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.remove}
          onPress={onRemove}
          accessibilityLabel={`Убрать: ${label}`}
        >
          <CloseIcon color={colors.muted} size={18} />
        </TouchableOpacity>
      ) : (
        <View style={styles.remove} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[10],
    paddingVertical: space[10],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: radius.xs },
  name: { flex: 1, alignItems: 'flex-start', gap: space[4] },
  hint: { fontSize: font.meta, color: colors.muted, paddingLeft: space[4] },
  rest: { fontSize: font.input, color: colors.text, fontVariant: ['tabular-nums'] },
  danger: { color: colors.danger },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: space[10],
  },
  inputText: {
    fontSize: font.input,
    color: colors.text,
    minWidth: 48,
    textAlign: 'right',
    paddingVertical: space[6],
    fontVariant: ['tabular-nums'],
  },
  symbol: { fontSize: font.input, color: colors.text },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
