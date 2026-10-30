import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import type { Bar } from '../model/trendsView';
import { styles } from './styles';

/**
 * A category's bars: the period looked at in its color, the usual ones pale, the rest grey; a day of the week has its
 * usual under it (grey) and a day to come only its label. `onPick` — a tap picks a bar (its sum is said under the chart).
 */
export default function TrendBars({ bars, color, height, picked, onPick, accessibilityLabelOf }: {
  bars: Bar[]; color: string; height: number;
  picked?: number | null; onPick?: (i: number) => void;
  accessibilityLabelOf?: (b: Bar) => string;
}) {
  const max = Math.max(1, ...bars.map((b) => Math.max(b.value ?? 0, b.usual ?? 0)));
  const px = (v: number) => (v > 0 ? Math.max(2, Math.round((v / max) * height)) : 0);
  const byDay = bars.some((b) => b.usual !== undefined);
  return (
    <View style={[styles.bars, { gap: byDay ? 10 : 4 }]} accessible={!onPick} accessibilityLabel={onPick ? undefined : bars.map((b) => accessibilityLabelOf?.(b) ?? b.label).join(', ')}>
      {bars.map((b, i) => {
        const body = (
          <>
            <View style={[styles.barColumn, { height }]}>
              {b.usual ? <View style={[styles.usual, { height: px(b.usual) }]} /> : null}
              <View style={[
                styles.bar,
                { height: px(b.value ?? 0), width: byDay ? '55%' : '100%', backgroundColor: b.tone === 'other' ? colors.border : color, opacity: b.tone === 'base' ? 0.4 : 1 },
                picked === i && styles.barPicked,
              ]} />
            </View>
            <Text style={[styles.barLabel, b.value === null && styles.barLabelLater, picked === i && styles.barLabelNow]} numberOfLines={1}>{b.label}</Text>
          </>
        );
        return onPick ? (
          <TouchableOpacity key={b.key} style={styles.barCell} onPress={() => onPick(i)} accessibilityRole="button" accessibilityLabel={accessibilityLabelOf?.(b) ?? b.label}>
            {body}
          </TouchableOpacity>
        ) : <View key={b.key} style={styles.barCell}>{body}</View>;
      })}
    </View>
  );
}
