import React from 'react';
import { StyleSheet, View } from 'react-native';
import { chart } from './theme';

/** Spent / limit: normal below 80%, warning up to 100%, critical above. */
export function meterColor(ratio: number): string {
  return ratio > 1 ? chart.critical : ratio >= 0.8 ? chart.warning : chart.meterFill;
}

type Props = {
  /** filled part, 0..1 (clamped) */
  ratio: number;
  height?: number;
  /** fixed fill color instead of the spent/limit thresholds */
  color?: string;
  marginTop?: number;
};

/** Thin progress bar with rounded ends. */
export default function Meter({ ratio, height = 6, color, marginTop = 8 }: Props) {
  const fill = { height, borderRadius: height / 2 };
  return (
    <View style={[styles.track, fill, { marginTop }]}>
      <View style={[fill, { width: `${Math.min(Math.max(ratio, 0), 1) * 100}%`, backgroundColor: color ?? meterColor(ratio) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: 'stretch', backgroundColor: chart.meterTrack, overflow: 'hidden' },
});
