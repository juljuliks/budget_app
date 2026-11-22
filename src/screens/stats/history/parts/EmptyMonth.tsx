import React from 'react';
import { Text, View } from 'react-native';
import { monthTitle } from '@/shared/lib/dates';
import { styles } from './styles';

/** A month of the year without anything to show: a coming one «впереди», one before the data «нет операций» — grey. */
export default function EmptyMonth({ ym, future }: { ym: string; future: boolean }) {
  return (
    <View style={[styles.month, styles.empty]}>
      <View style={styles.monthTop}>
        <Text style={styles.monthTitle}>{monthTitle(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1)}</Text>
        <Text style={styles.monthTitle}>{future ? 'впереди' : 'нет операций'}</Text>
      </View>
    </View>
  );
}
