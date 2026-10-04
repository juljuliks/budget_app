import React from 'react';
import { StyleSheet, View } from 'react-native';
import { chart, colors, meterColor } from './theme';

type Props = {
  /** filled part, 0..1 (clamped) */
  ratio: number;
  height?: number;
  /** fixed fill color instead of the spent/limit thresholds */
  color?: string;
  marginTop?: number;
  /** the first part of the fill drawn faded (0..ratio): e.g. the month's spending before the viewed period */
  base?: number;
  /** a thin tick at this point, 0..1: where the spending should be by now at an even pace */
  marker?: number;
};

const clamp = (v: number) => Math.min(Math.max(v, 0), 1);

/** Thin progress bar with rounded ends; optionally a faded first part and a pace tick. */
export default function Meter({ ratio, height = 6, color, marginTop = 8, base = 0, marker }: Props) {
  const fill = { height, borderRadius: height / 2 };
  const total = clamp(ratio);
  const faded = Math.min(clamp(base), total);
  const backgroundColor = color ?? meterColor(ratio);
  return (
    <View style={{ marginTop }}>
      <View style={[styles.track, fill]}>
        <View style={[styles.fills, { width: `${total * 100}%` }]}>
          {faded > 0 ? <View style={{ height, width: `${(faded / total) * 100}%`, backgroundColor, opacity: 0.4 }} /> : null}
          <View style={{ height, flex: 1, backgroundColor }} />
        </View>
      </View>
      {marker !== undefined ? (
        <View
          style={[styles.marker, { height: height + 6, top: -3, left: `${clamp(marker) * 100}%` }]}
          accessibilityLabel={`Ровный темп: ${Math.round(clamp(marker) * 100)}%`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: 'stretch', backgroundColor: chart.meterTrack, overflow: 'hidden' },
  fills: { flexDirection: 'row', height: '100%', borderRadius: 999, overflow: 'hidden' },
  marker: { position: 'absolute', width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.text },
});
