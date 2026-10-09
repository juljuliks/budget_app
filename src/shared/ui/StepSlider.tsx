import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

const THUMB = 24;

type Props = {
  /** the stops, left to right */
  values: number[];
  value: number;
  onChange: (v: number) => void;
  /** a stop past this can't be picked (shown faded): what doesn't fit */
  max?: number;
  /** the label under a stop: "20%" */
  label?: (v: number) => string;
  color?: string;
};

/**
 * A slider snapping to a few stops (0 / 10 / … / 50%): drag the thumb or tap the track. Made of views and a
 * PanResponder, no native slider needed.
 */
export default function StepSlider({ values, value, onChange, max, label = String, color = colors.accent }: Props) {
  const [width, setWidth] = useState(0);
  // the latest props for the responder, which is created once
  const live = useRef({ values, onChange, max, width, value });
  live.current = { values, onChange, max, width, value };
  const startX = useRef(0);

  const step = (n: number) => (n <= 1 ? 0 : (width - THUMB) / (n - 1));
  // a value between the stops (an amount of one's own): no stop picked, no thumb
  const picked = values.indexOf(value);
  const index = Math.max(0, picked);

  const pick = (x: number) => {
    const { values: vs, onChange: change, max: m, width: w, value: cur } = live.current;
    const span = w - THUMB;
    if (span <= 0) return;
    const i = Math.min(vs.length - 1, Math.max(0, Math.round(((x - THUMB / 2) / span) * (vs.length - 1))));
    // past what fits: the last stop that does
    let v = vs[i];
    if (m !== undefined && v > m) v = [...vs].reverse().find((s) => s <= m) ?? vs[0];
    if (v !== cur) change(v);
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // don't hand the drag over to the sheet's swipe-down
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { startX.current = e.nativeEvent.locationX; pick(startX.current); },
    onPanResponderMove: (_, g) => pick(startX.current + g.dx),
  })).current;

  return (
    <View>
      <View
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: label(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = values[index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)];
          if (next !== undefined && (max === undefined || next <= max)) onChange(next);
        }}
      >
        <View style={styles.rail} pointerEvents="none">
          {picked >= 0 ? <View style={[styles.fill, { width: index * step(values.length) + THUMB / 2, backgroundColor: color }]} /> : null}
        </View>
        {values.map((v, i) => (
          <View
            key={v}
            pointerEvents="none"
            style={[styles.tick, { left: i * step(values.length) + THUMB / 2 - 3 }, max !== undefined && v > max && styles.faded,
              picked >= 0 && i <= index && { backgroundColor: color }]}
          />
        ))}
        {width > 0 && picked >= 0 ? (
          <View pointerEvents="none" style={[styles.thumb, { left: index * step(values.length), borderColor: color }]} />
        ) : null}
      </View>
      <View style={styles.labels} pointerEvents="none">
        {values.map((v, i) => (
          <Text
            key={v}
            style={[styles.label, { left: i * step(values.length) + THUMB / 2 - 20 }, v === value && styles.labelOn,
              max !== undefined && v > max && styles.faded]}
          >
            {label(v)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 36, justifyContent: 'center' },
  rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: colors.border },
  fill: { height: 4, borderRadius: 2 },
  tick: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3, backgroundColor: colors.bg,
  },
  labels: { height: 18 },
  label: { position: 'absolute', width: 40, textAlign: 'center', fontSize: 12, color: colors.muted },
  labelOn: { color: colors.text, fontWeight: '600' },
  faded: { opacity: 0.35 },
});
