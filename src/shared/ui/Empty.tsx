import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme/theme';
import { font, space } from '../theme/tokens';

type Props = {
  children: string;
  /** in a sheet, under a search: less room around */
  compact?: boolean;
  /** in a block of a page, from the left like its rows */
  inline?: boolean;
};

/** Nothing to show: grey text in place of a list ("Не найдено.", "Категорий нет. Нажмите «Создать».") */
export default function Empty({ children, compact, inline }: Props) {
  return <Text style={[styles.empty, compact && styles.compact, inline && styles.inline]}>{children}</Text>;
}

const styles = StyleSheet.create({
  empty: { fontSize: font.secondary, color: colors.muted, textAlign: 'center', padding: space[32] },
  compact: { paddingVertical: space[16], paddingHorizontal: space[16] },
  inline: { fontSize: font.body, textAlign: 'left', paddingHorizontal: space[16], paddingVertical: space[14] },
});
