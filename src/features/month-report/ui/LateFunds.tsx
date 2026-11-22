import React from 'react';
import { View } from 'react-native';
import { dayTitle } from '@/shared/lib/dates';
import TextLink from '@/shared/ui/TextLink';
import type { LateFund } from '../model/useMonthReport';
import { styles } from './styles';

/** «⚠ 🏖 Отпуск не успевает к 31 июля 2027 ›»: the funds not making it, on «Отложено». */
export default function LateFunds({ late, onOpen }: { late: LateFund[]; onOpen: (id: number) => void }) {
  if (!late.length) return null;
  return (
    <View style={styles.block}>
      {late.map((f) => <TextLink key={f.id} label={`⚠ ${f.label} не успевает к ${dayTitle(f.due)}`} onPress={() => onOpen(f.id)} style={styles.over} />)}
    </View>
  );
}
