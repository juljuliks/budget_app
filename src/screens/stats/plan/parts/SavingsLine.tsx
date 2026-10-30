import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { percentOf, PlanView } from '../model/planView';
import { styles } from './styles';

/**
 * Under the budget: what goes to savings of what is planned — "В сбережения идёт 741.57 из 746.85 ₾" (a past month:
 * "ушло"); "Подробнее ›" — what the overspend took («Сбережения меньше на …»), or with none the stats' «Сбережения». A coming month,
 * nothing planned: none.
 */
export default function SavingsLine({ p, onMore }: { p: PlanView; onMore: () => void }) {
  if (p.savingsNow === null || p.savingsPlanned <= 0) return null;
  const verb = p.timing === 'past' ? 'ушло' : 'идёт';
  const text = p.hidden
    ? `В сбережения ${verb} ${percentOf(Math.max(0, p.savingsNow), p.savingsPlanned) || '0%'} плана`
    : `В сбережения ${verb} ${p.money(Math.max(0, p.savingsNow))} из ${p.money(p.savingsPlanned)}`;
  return (
    <View style={styles.savingsLine}>
      <Text style={styles.savingsLineText}>{text}</Text>
      <TouchableOpacity onPress={onMore} hitSlop={8} accessibilityRole="button" accessibilityLabel="Сбережения подробнее">
        <Text style={styles.iconsLinkText}>Подробнее ›</Text>
      </TouchableOpacity>
    </View>
  );
}
