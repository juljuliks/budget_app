import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Currency, CURRENCY_SYMBOLS } from '@/db/fx';
import Segmented from '@/shared/ui/Segmented';

/**
 * A report's page: in the budget's currency (first) or the system one (Настройки → Валюта) — «$ USD | ₾ GEL»; the
 * same one — nothing to pick, not shown.
 */
export default function CurrencyChoice({
  budget,
  system,
  value,
  onChange,
  style,
}: {
  budget: Currency;
  system: Currency;
  value: Currency;
  onChange: (c: Currency) => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (budget === system) return null;
  // the budget's first
  const options = [
    [budget, `${CURRENCY_SYMBOLS[budget]} ${budget}`],
    [system, `${CURRENCY_SYMBOLS[system]} ${system}`],
  ] as const;
  return <Segmented options={options} value={value} onChange={onChange} style={[styles.choice, style]} />;
}

const styles = StyleSheet.create({
  choice: { marginTop: 12 },
});
