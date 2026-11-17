import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from './styles';

/** A month without a plan: «＋» adds its categories; its budget — a link. */
export default function NoPlan({ onBudget }: { onBudget: () => void }) {
  return (
    <View style={styles.noPlan}>
      <Text style={styles.hint}>Составьте план на месяц, чтобы видеть, сколько осталось по категориям: ＋ — добавить категорию в план.</Text>
      <TouchableOpacity onPress={onBudget} hitSlop={8} accessibilityRole="button">
        <Text style={styles.planLink}>Бюджет месяца ›</Text>
      </TouchableOpacity>
    </View>
  );
}
