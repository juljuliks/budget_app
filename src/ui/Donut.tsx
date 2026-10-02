import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { chart } from './theme';

export type DonutSegment = { key: string; value: number; color: string };

type Props = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** rendered in the hole */
  children?: React.ReactNode;
};

const GAP = 2; // surface gap between segments, px along the ring

/** Part-to-whole ring; segments with value <= 0 are skipped. */
export default function Donut({ segments, size = 220, thickness = 22, children }: Props) {
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
            />
          ))}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
