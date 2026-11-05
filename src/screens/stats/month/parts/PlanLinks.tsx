import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { openPlan } from '@/shared/navigation/navigation';
import { useHasPlan } from '../model/useHasPlan';
import { styles } from './styles';

/** Under the month, on the right: its plan, a page — «Изменить план ›» (none yet: «Составить план ›»). */
export default function PlanLinks({ ym }: { ym: string }) {
  const has = useHasPlan(ym);
  if (has === null || has) return null;
  return (
    <View style={styles.planLinks}>
      <TouchableOpacity onPress={() => openPlan(ym)} hitSlop={8} accessibilityRole="button">
        <Text style={styles.planLink}>Составить план ›</Text>
      </TouchableOpacity>
    </View>
  );
}
