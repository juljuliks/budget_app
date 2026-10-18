import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { openCategory } from '@/shared/navigation/sheets';
import TextLink from '@/shared/ui/TextLink';

type Props = {
  categoryId: number;
  /** what it says: "🛒 Продукты", with its section where it helps */
  label: string;
  /** the text's size and spacing where it stands; the color is the link's */
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

/** A category's name as a link, as a merchant's (MerchantLink): "🛒 Продукты ›" opens its sheet over whatever is open. */
export default function CategoryLink({ categoryId, label, style, containerStyle }: Props) {
  return <TextLink label={label} onPress={() => openCategory(categoryId)} style={style} containerStyle={containerStyle} hint="Открыть категорию" />;
}
