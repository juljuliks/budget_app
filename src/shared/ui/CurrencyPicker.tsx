import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Currency, CURRENCY_SYMBOLS } from '@/db/fx';
import Segmented from './Segmented';

// in this order on every switch
export const CURRENCY_ORDER: Currency[] = ['USD', 'GEL', 'EUR'];
const OPTIONS = CURRENCY_ORDER.map((c) => [c, `${CURRENCY_SYMBOLS[c]} ${c}`] as const);

/** GEL / USD / EUR switch: the currency of an amount being entered, or the one stats are shown in. */
export default function CurrencyPicker({ value, onChange, style }: { value: Currency; onChange: (c: Currency) => void; style?: StyleProp<ViewStyle> }) {
  return <Segmented options={OPTIONS} value={value} onChange={onChange} style={style} />;
}
