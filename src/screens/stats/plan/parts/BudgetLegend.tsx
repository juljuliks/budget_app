import React, { useState } from 'react';
import { LayoutChangeEvent, Text, TouchableOpacity, View } from 'react-native';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import { InfoIcon } from '@/shared/ui/icons';
import { BudgetPart, percentOf, PlanView } from '../model/planView';
import { RING_DEBT, RING_LOCKED } from './palette';
import { styles, toneStyle } from './styles';

/**
 * The bar's parts as a legend, a line each: its dot, name, share — the shares in a column right by the names (as wide as
 * the longest one) — and the amount at the right edge. Savings the overspend took part of: what is left, and a line of
 * its own for what it took ("Перерасход", red as in the bar: the shares add up to the whole) — a tap, what took it (ⓘ).
 */
export default function BudgetLegend({ p, onLess }: { p: PlanView; onLess: () => void }) {
  // the names' column: as wide as the widest name (measured in an invisible column of them all)
  const [nameWidth, setNameWidth] = useState(0);
  const measure = (e: LayoutChangeEvent) => setNameWidth(Math.ceil(e.nativeEvent.layout.width));
  const { locked, free } = p;
  const shown = p.parts.filter((x) => x.key !== 'unplanned' || p.unplanned > 0).flatMap((x): BudgetPart[] => (x.was === undefined ? [x] : [
    { ...x, was: undefined },
    { key: 'eaten', label: 'Перерасход', value: x.was - x.value, color: RING_DEBT, note: p.shownBudget ? percentOf(x.was - x.value, p.shownBudget) || '0%' : '', tone: 'over', noteTone: 'over' },
  ]));
  return (
    <View style={styles.parts}>
      {/* no share for spending outside the plan: no line for it */}
      {shown.map((x) => (
        // what the overspend took of the savings: the whole line explains it
        <TouchableOpacity
          key={x.key} style={styles.part} onPress={onLess} disabled={x.key !== 'eaten'}
          accessibilityRole={x.key === 'eaten' ? 'button' : undefined} accessibilityLabel={x.key === 'eaten' ? 'Перерасход: что съело сбережения' : undefined}
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
          <View style={nameWidth ? { width: nameWidth } : undefined}>
            <Text style={styles.partLabel} numberOfLines={1}>{x.label}</Text>
          </View>
          <Text style={[styles.partNote, toneStyle(x.noteTone)]} numberOfLines={1}>{x.note}</Text>
          <View style={styles.partValues}>
            <Masked style={[styles.partValue, toneStyle(x.tone)]}>{p.money(x.value)}</Masked>
            {x.key === 'eaten' ? <InfoIcon color={colors.accent} size={14} /> : null}
          </View>
        </TouchableOpacity>
      ))}
      <View style={styles.measure} onLayout={measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {shown.map((x) => <Text key={x.key} style={styles.partLabel}>{x.label}</Text>)}
      </View>
    </View>
  );
}
