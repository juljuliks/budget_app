import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  label: string;
  onPress: () => void;
  /** the text's size and weight where it stands; the color is the link's */
  style?: StyleProp<TextStyle>;
  /** the touchable's place in its row (flex, margins) */
  containerStyle?: StyleProp<ViewStyle>;
  /** what a tap opens, for a screen reader ("Открыть мерчанта") */
  hint?: string;
  /** read instead of the text */
  accessibilityLabel?: string;
  /** cut to one line (a sheet's title); otherwise it wraps */
  oneLine?: boolean;
};

/**
 * A name as a link: blue text with an arrow, "SPAR ›", "🛒 Продукты ›". One look for every merchant and category
 * shown in a sheet (MerchantLink, CategoryLink) and for a sheet's title that opens its category.
 */
export default function TextLink({ label, onPress, style, containerStyle, hint, accessibilityLabel, oneLine }: Props) {
  return (
    <TouchableOpacity style={containerStyle} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityHint={hint} accessibilityLabel={accessibilityLabel}>
      <Text style={[styles.text, style, styles.link]} numberOfLines={oneLine ? 1 : undefined}>{`${label} ›`}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16 },
  link: { color: colors.accent },
});
