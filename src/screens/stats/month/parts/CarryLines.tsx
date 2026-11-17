import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import type { PlanView } from '../../plan/model/planView';
import { styles } from './styles';

/**
 * Under the month's bar: what the month before sent — its overspend taken off this budget, its leftover added to it;
 * a tap asks how to cover it / where it goes (CarrySheet).
 */
export default function CarryLines({ p, onOpen }: { p: PlanView | null; onOpen: (kind: 'debt' | 'plus') => void }) {
  const rows = p?.systemGroups.flatMap((g) => g.rows).filter((r) => r.carry) ?? [];
  return (
    <>
      {rows.map((r) => (
        <TouchableOpacity key={r.key} onPress={() => onOpen(r.carry!)} hitSlop={6} accessibilityRole="button">
          <Text style={[styles.carryLine, r.tone === 'over' ? styles.overLine : styles.paceOk]}>
            {`${r.name}${p!.hidden ? '' : ` ${r.carry === 'plus' ? '+' : '−'}${p!.money(r.value)}`}`}
            <Text style={styles.rowStatusMuted}>{` · ${r.note} ›`}</Text>
          </Text>
        </TouchableOpacity>
      ))}
    </>
  );
}
