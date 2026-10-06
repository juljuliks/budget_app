import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { useHideAmounts } from '../hideAmounts';
import { colors } from './theme';

/**
 * An amount that "Скрыть суммы" blurs: the text turns transparent and only its soft shadow is left, so the place and
 * length of the number stay but the digits can't be read. No native blur needed.
 */
export default function Masked({ style, children }: { style?: StyleProp<TextStyle>; children: React.ReactNode }) {
  const hidden = useHideAmounts();
  if (!hidden) return <Text style={style}>{children}</Text>;
  const color = (StyleSheet.flatten(style)?.color as string | undefined) ?? colors.text;
  const size = StyleSheet.flatten(style)?.fontSize ?? 14;
  return (
    <Text
      style={[style, { color: 'transparent', textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: Math.max(14, size) }]}
      accessibilityLabel="Скрыто"
    >
      {children}
    </Text>
  );
}

/**
 * A section header's "spent / plan (%)": "Скрыть суммы" leaves it out (not blurred).
 */
export function MaskedTotal({ style, hiddenText, children }: {
  style?: StyleProp<TextStyle>;
  /** shown instead when hidden: what tells nothing of the amounts, e.g. the section's share of the spending "34%" */
  hiddenText?: string;
  children: React.ReactNode;
}) {
  const hidden = useHideAmounts();
  if (!hidden) return <Text style={style}>{children}</Text>;
  return hiddenText ? <Text style={style}>{hiddenText}</Text> : null;
}
