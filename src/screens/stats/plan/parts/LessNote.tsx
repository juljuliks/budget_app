import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { InfoIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { styles } from './styles';

/**
 * After savings the overspend took part of: "(−15 ₾ ⓘ)" — by how much; a tap — what took it (without `onPress` the line
 * it is in takes the tap, the legend's).
 */
export default function LessNote({ less, money, onPress }: { less: number; money: (minor: number) => string; onPress?: () => void }) {
  const body = (
    <>
      <Masked style={styles.lessText}>{`(−${money(less)}`}</Masked>
      <InfoIcon color={colors.accent} size={14} />
      <Text style={styles.lessText}>)</Text>
    </>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} hitSlop={8} style={styles.less} accessibilityRole="button" accessibilityLabel="Почему сбережения меньше">
      {body}
    </TouchableOpacity>
  ) : <View style={styles.less}>{body}</View>;
}
