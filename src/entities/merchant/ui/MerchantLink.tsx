import React from 'react';
import { StyleProp, Text, TextStyle, TouchableOpacity } from 'react-native';
import { openMerchant } from '@/shared/navigation/sheets';
import { colors } from '@/shared/theme/theme';

type Props = {
  merchantKey: string;
  /** what it says: the merchant's name, or the operation's title with it ("Оплата · TELMICO") */
  label: string;
  /** the text's size and spacing where it stands; the color is the link's */
  style?: StyleProp<TextStyle>;
};

/** A merchant's name as a link: "SPAR ›" opens its card (its category, its operations) over whatever is open. */
export default function MerchantLink({ merchantKey, label, style }: Props) {
  return (
    <TouchableOpacity onPress={() => openMerchant(merchantKey)} hitSlop={6} accessibilityRole="button" accessibilityHint="Открыть мерчанта">
      <Text style={[style, { color: colors.accent }]}>{label} ›</Text>
    </TouchableOpacity>
  );
}
