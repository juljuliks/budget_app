import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { InfoIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { styles } from './styles';

type Props = { label: string; less: number; money: (minor: number) => string; onPress?: () => void };

/** Savings the overspend took part of, by how much, under a plan's row: "перерасход: −15 ₾ ⓘ"; a tap — what took it. */
export default function LessNote({ label, less, money, onPress }: Props) {
  const body = (
    <>
      <Text style={styles.lessText}>{`${label}: `}</Text>
      <Masked style={[styles.lessText, styles.lessMinus]}>{`−${money(less)}`}</Masked>
      <InfoIcon color={colors.accent} size={13} />
    </>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} hitSlop={8} style={styles.less} accessibilityRole="button" accessibilityLabel="Почему сбережения меньше">
      {body}
    </TouchableOpacity>
  ) : <View style={styles.less}>{body}</View>;
}
