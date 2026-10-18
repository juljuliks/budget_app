import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { openMerchant } from '@/shared/navigation/sheets';
import TextLink from '@/shared/ui/TextLink';

type Props = {
  merchantKey: string;
  /** what it says: the merchant's name, or the operation's title with it ("Оплата · TELMICO") */
  label: string;
  /** the text's size and spacing where it stands; the color is the link's */
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

/** A merchant's name as a link: "SPAR ›" opens its card (its category, its operations) over whatever is open. */
export default function MerchantLink({ merchantKey, label, style, containerStyle }: Props) {
  return <TextLink label={label} onPress={() => openMerchant(merchantKey)} style={style} containerStyle={containerStyle} hint="Открыть мерчанта" />;
}
