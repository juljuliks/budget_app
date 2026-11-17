// A payment charged several times in a month (each week, several subscriptions): one piece per charge, the done ones
// filled in the category's color.
import React from 'react';
import { View } from 'react-native';
import { styles } from './styles';

export default function PaymentsBar({ total, done, color }: { total: number; done: number; color: string }) {
  return (
    <View style={styles.payments} accessibilityLabel={`Оплачено ${done} из ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.paymentPiece, i < done && { backgroundColor: color }]} />
      ))}
    </View>
  );
}
