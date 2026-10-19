import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Masked from '@/shared/ui/Masked';
import LessNote from './LessNote';
import type { PlanView } from '../model/planView';
import { RING_LOCKED } from './palette';
import { styles, toneStyle } from './styles';

/**
 * The bar's parts as a legend, a line each: its dot and name, the amount at the right edge and its share under it.
 * Savings the overspend took part of: "перерасход: −15 ₾ ⓘ" under the name; a tap on the line — what took it.
 */
export default function BudgetLegend({ p, onLess }: { p: PlanView; onLess: () => void }) {
  const { locked, free } = p;
  const shown = p.parts.filter((x) => x.key !== 'unplanned' || p.unplanned > 0);
  return (
    <View style={styles.parts}>
      {/* no share for spending outside the plan: no line for it */}
      {shown.map((x) => (
        // savings the overspend took part of: the whole line explains it
        <TouchableOpacity
          key={x.key} style={styles.part} onPress={onLess} disabled={x.was === undefined}
          accessibilityRole={x.was === undefined ? undefined : 'button'} accessibilityLabel={x.was === undefined ? undefined : 'Сбережения: почему меньше'}
        >
          {/* the dots in a box of one width: the names start in one column; savings holding both the leftover and the
              locked part — two dots, the locked one over the other */}
          <View style={styles.legendBox}>
            {x.key === 'free' && locked > 0 && (free ?? 0) > 0 ? (
              <View style={styles.legendPair}>
                <View style={[styles.legendDot, { backgroundColor: x.color }]} />
                <View style={[styles.legendDot, styles.legendOver, { backgroundColor: RING_LOCKED }]} />
              </View>
            ) : <View style={[styles.legendDot, { backgroundColor: x.key === 'free' && locked > 0 ? RING_LOCKED : x.color }]} />}
          </View>
          <View style={styles.partName}>
            <Text style={styles.partLabel} numberOfLines={1}>{x.label}</Text>
            {x.was !== undefined ? <LessNote label="перерасход" less={x.was - x.value} money={p.money} /> : null}
          </View>
          <View style={styles.partValues}>
            <Masked style={[styles.partValue, toneStyle(x.tone)]}>{p.money(x.value)}</Masked>
            <Text style={[styles.partNote, toneStyle(x.noteTone)]} numberOfLines={1}>{x.note}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
