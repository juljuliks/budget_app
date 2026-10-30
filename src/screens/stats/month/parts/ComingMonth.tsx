import React from 'react';
import { Text, View } from 'react-native';
import { parseYm } from '@/db/plans';
import { MONTHS } from '@/shared/lib/dates';
import { openPlan } from '@/shared/navigation/navigation';
import Button from '@/shared/ui/Button';
import { useHasPlan } from '../model/useHasPlan';
import { styles } from './styles';

/** The next month in the stats: no spending yet — its plan made in advance («Составить план» / «Изменить план»). */
export default function ComingMonth({ ym }: { ym: string }) {
  const has = useHasPlan(ym);
  const name = MONTHS[parseYm(ym).month];
  return (
    <View style={styles.coming}>
      <Text style={styles.comingTitle}>{`${name} ещё не начался`}</Text>
      <Text style={styles.hint}>{has ? 'План уже составлен — его можно поменять.' : 'Составьте план заранее: бюджет, лимиты, что отложить сразу.'}</Text>
      {has === null ? null : <Button title={has ? 'Изменить план' : 'Составить план'} onPress={() => openPlan(ym)} />}
    </View>
  );
}
