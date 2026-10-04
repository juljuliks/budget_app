import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Currency, CURRENCY_SYMBOLS } from '../db/fx';
import BottomSheet from './BottomSheet';
import { ChevronDownIcon } from './icons';
import { CURRENCY_ORDER } from './CurrencyPicker';
import { colors } from './theme';

const NAMES: Record<Currency, string> = { GEL: 'Лари', USD: 'Доллар США', EUR: 'Евро' };

/** A compact currency choice next to an amount: "₾ ▾", the options in a sheet. */
export default function CurrencyButton({ value, onChange, style }: { value: Currency; onChange: (c: Currency) => void; style?: StyleProp<ViewStyle> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Валюта: ${NAMES[value]}`}
        hitSlop={6}
      >
        <Text style={styles.symbol}>{CURRENCY_SYMBOLS[value]}</Text>
        {/* the same chevron as the stats period picker, sized to the symbol */}
        <ChevronDownIcon color={colors.accent} size={14} />
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Валюта">
        {CURRENCY_ORDER.map((c) => (
          <TouchableOpacity
            key={c}
            style={styles.option}
            onPress={() => { onChange(c); setOpen(false); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: c === value }}
          >
            <Text style={styles.optionSymbol}>{CURRENCY_SYMBOLS[c]}</Text>
            <View style={styles.optionText}>
              <Text style={styles.optionName}>{NAMES[c]}</Text>
              <Text style={styles.optionCode}>{c}</Text>
            </View>
            {c === value ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  symbol: { fontSize: 16, fontWeight: '600', color: colors.text },
  option: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  optionSymbol: { width: 32, fontSize: 20, fontWeight: '600', color: colors.text },
  optionText: { flex: 1 },
  optionName: { fontSize: 16, color: colors.text },
  optionCode: { fontSize: 13, color: colors.muted },
  check: { fontSize: 18, color: colors.accent, fontWeight: '700' },
});
