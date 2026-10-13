import React, { useState } from 'react';
import { LayoutChangeEvent, Text, TouchableOpacity, View } from 'react-native';
import { InfoIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { RING_LOCKED } from './palette';
import { styles, toneStyle } from './styles';

/**
 * The bar's parts as a legend, a line each: its dot, name, share — the shares in a column right by the names (as wide as
 * the longest one) — and the amount at the right edge. Savings the overspend took part of: the planned amount struck,
 * then what is left, and ⓘ (what took it).
 */
export default function BudgetLegend({ p, onLess }: { p: PlanView; onLess: () => void }) {
  // the names' column: as wide as the widest name (measured in an invisible column of them all)
  const [nameWidth, setNameWidth] = useState(0);
  const measure = (e: LayoutChangeEvent) => setNameWidth(Math.ceil(e.nativeEvent.layout.width));
  const { locked, free } = p;
  const info = p.parts.some((x) => x.was !== undefined);
  const shown = p.parts.filter((x) => x.key !== 'unplanned' || p.unplanned > 0);
  return (
    <View style={styles.parts}>
      {/* no share for spending outside the plan: no line for it */}
      {shown.map((x) => (
        <View key={x.key} style={styles.part}>
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
          <View style={nameWidth ? { width: nameWidth } : undefined}>
            <Text style={styles.partLabel} numberOfLines={1}>{x.label}</Text>
          </View>
          <Text style={[styles.partNote, toneStyle(x.noteTone)]} numberOfLines={1}>{x.note}</Text>
          <View style={styles.partValues}>
            {x.was !== undefined ? <Masked style={styles.partWas}>{p.money(x.was)}</Masked> : null}
            <Masked style={[styles.partValue, toneStyle(x.tone)]}>{p.money(x.value)}</Masked>
          </View>
          {info ? (
            <View style={styles.partInfo}>
              {x.was !== undefined ? (
                <TouchableOpacity onPress={onLess} hitSlop={8} accessibilityRole="button" accessibilityLabel="Почему сбережения меньше">
                  <InfoIcon color={colors.accent} size={16} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
      <View style={styles.measure} onLayout={measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {shown.map((x) => <Text key={x.key} style={styles.partLabel}>{x.label}</Text>)}
      </View>
    </View>
  );
}
