import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextField from '@/shared/ui/TextField';
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
        <TextField
          amount
          compact
          maxLength={undefined}
          value={text}
          onChangeText={onText}
          placeholder="0"
          textAlign="right"
          inputStyle={styles.inputText}
          accessibilityLabel={`Сумма: ${label}`}
          autoFocus={text === ''}
          suffix={currencySymbol(currency)}
        />
      )}
      {onRemove ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.remove}
          onPress={onRemove}
          hitSlop={6}
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
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  name: { flex: 1, alignItems: 'flex-start', gap: space[4] },
  hint: { fontSize: font.meta, color: colors.muted, paddingLeft: space[4] },
  rest: { fontSize: font.input, color: colors.text, fontVariant: ['tabular-nums'] },
  danger: { color: colors.danger },
  // a split's amount: as wide as its digits, at the right
  inputText: { minWidth: 48 },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
