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
  /**
   * an overspend, 0..1: where the limit is on a bar scaled to the spending — the fill up to it is solid, the part
   * over the limit faded, with a tick at the limit
   */
  over?: number;
  /** only the tick at the limit, 0..1 (a bar scaled to the spending whose faded part is `base`) */
  limitTick?: number;
};

const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
/** a limit tick this close to the bar's end isn't drawn */
const TICK_AT_END = 0.97;

/** Thin progress bar with rounded ends; optionally a faded first part and a pace tick. */
export default function Meter({ ratio, height = 6, color, marginTop = 8, base = 0, marker, over, limitTick }: Props) {
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
          {over !== undefined ? <View style={{ height, width: `${(1 - clamp(over)) * 100}%`, backgroundColor, opacity: 0.4 }} /> : null}
        </View>
      </View>
      {/* the limit's tick, unless it is at the bar's very end (a tiny overspend): there it only looks like the bar's edge */}
      {(over ?? limitTick) !== undefined && clamp((over ?? limitTick)!) < TICK_AT_END ? (
        <View style={[styles.marker, { height: height + 6, top: -3, left: `${clamp((over ?? limitTick)!) * 100}%` }]} accessibilityLabel="Лимит" />
      ) : null}
      {marker !== undefined ? (
        <View
          style={[styles.marker, { height: height + 6, top: -3, left: `${clamp(marker) * 100}%` }]}
          accessibilityLabel={`Отметка ровного темпа: ${Math.round(clamp(marker) * 100)}%`}
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
