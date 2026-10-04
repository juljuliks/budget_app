import React from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { chart } from './theme';

export type DonutSegment = { key: string; value: number; color: string };

type Props = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** rendered in the hole */
  children?: React.ReactNode;
  /** the highlighted segment (the others are dimmed) */
  selectedKey?: string | null;
  /** tap on a segment selects it; a tap anywhere else (the hole) clears the selection */
  onSelect?: (key: string | null) => void;
};

const GAP = 2; // surface gap between segments, px along the ring

/** Part-to-whole ring; segments with value <= 0 are skipped. Optionally a segment can be tapped to select it. */
export default function Donut({ segments, size = 220, thickness = 22, children, selectedKey = null, onSelect }: Props) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);

  let offset = 0;
  const arcs = visible.map((s) => {
    const len = (s.value / total) * c;
    // single segment: full ring, no gap
    const dash = visible.length === 1 ? c : Math.max(len - GAP, 0.5);
    const arc = { ...s, dash, offset };
    offset += len;
    return arc;
  });

  // which segment is under the finger: distance from the center (on the ring?) and angle from 12 o'clock
  function press(e: GestureResponderEvent) {
    if (!onSelect) return;
    const dx = e.nativeEvent.locationX - size / 2;
    const dy = e.nativeEvent.locationY - size / 2;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dist - r) > thickness / 2 + 10) { onSelect(null); return; }
    const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
    const at = (angle / (2 * Math.PI)) * c;
    const hit = arcs.find((a) => at >= a.offset && at < a.offset + (a.value / total) * c);
    onSelect(hit && hit.key !== selectedKey ? hit.key : null);
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* start at 12 o'clock, clockwise */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={chart.track} strokeWidth={thickness} fill="none" />
          {arcs.map((a) => (
            <Circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={a.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={-a.offset}
              strokeOpacity={selectedKey !== null && a.key !== selectedKey ? 0.3 : 1}
            />
          ))}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">{children}</View>
      {/* a transparent layer on top takes the tap (the svg would swallow it), coordinates relative to the ring's box */}
      {onSelect ? (
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={press}
          accessibilityLabel="Диаграмма: нажмите на часть, чтобы увидеть категорию"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
