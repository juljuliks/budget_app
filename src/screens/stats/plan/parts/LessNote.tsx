import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { InfoIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { styles } from './styles';

type Props = { label?: string; less: number; money: (minor: number) => string; onPress?: () => void };

/**
 * Savings the overspend took part of, by how much: under a plan's row "перерасход: −15 ₾ ⓘ" (`label`), in the legend
 * "(−15 ₾ ⓘ)" (none); a tap — what took it (without `onPress` the line it is in takes the tap, the legend's).
 */
export default function LessNote({ label, less, money, onPress }: Props) {
  const body = label ? (
    <>
      <Text style={styles.lessText}>{`${label}: `}</Text>
      <Masked style={[styles.lessText, styles.lessMinus]}>{`−${money(less)}`}</Masked>
      <InfoIcon color={colors.accent} size={13} />
    </>
  ) : (
    <>
      <Masked style={styles.lessParenText}>{`(−${money(less)}`}</Masked>
      <InfoIcon color={colors.accent} size={14} />
      <Text style={styles.lessParenText}>)</Text>
    </>
  );
  const box = label ? styles.less : styles.lessParen;
  return onPress ? (
    <TouchableOpacity onPress={onPress} hitSlop={8} style={box} accessibilityRole="button" accessibilityLabel="Почему сбережения меньше">
      {body}
    </TouchableOpacity>
  ) : <View style={box}>{body}</View>;
}
