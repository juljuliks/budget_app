import React from 'react';
import { Text, View } from 'react-native';
import { styles } from './styles';
import TextLink from '@/shared/ui/TextLink';

/** A month without a plan: «＋» adds its categories; its budget — a link. */
export default function NoPlan({ onBudget }: { onBudget: () => void }) {
  return (
    <View style={styles.noPlan}>
      <Text style={styles.hint}>
        Составьте план на месяц, чтобы видеть, сколько осталось по категориям: ＋ — добавить категорию в план.
      </Text>
      <TextLink label="Бюджет месяца" onPress={onBudget} style={styles.planLink} />
    </View>
  );
}
