import React from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { WarnTriangleIcon } from './icons';
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
   * an overspend, 0..1: where the limit is on a bar scaled to the spending — the fill up to it in the bar's color,
   * the part over the limit orange with ⚠ inside, a tick at the limit
   */
  over?: number;
  /** the tick at the limit, 0..1, on a bar scaled to the spending whose faded part is `base`; past it orange as `over` */
  limitTick?: number;
};

const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
/** a limit tick this close to the bar's end isn't drawn */
const TICK_AT_END = 0.97;
/** the ⚠ in the overspend: drawn when its part is at least this much wider than it */
const ICON_ROOM = 4;

/** Thin progress bar with rounded ends; optionally a faded first part and a pace tick. */
export default function Meter({ ratio, height = 6, color, marginTop = 8, base = 0, marker, over, limitTick }: Props) {
  const fill = { height, borderRadius: height / 2 };
  const total = clamp(ratio);
  const faded = Math.min(clamp(base), total);
  const backgroundColor = color ?? meterColor(ratio);
  // the limit on a bar scaled to the spending: past it, the overspend
  const at = over ?? limitTick;
  const [width, setWidth] = React.useState(0);
  const icon = height + 4;
  const overWidth = at === undefined ? 0 : (1 - clamp(at)) * width;
  return (
    <View style={{ marginTop }} onLayout={at === undefined ? undefined : (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.track, fill]}>
        <View style={[styles.fills, { width: `${total * 100}%` }]}>
          {faded > 0 ? <View style={{ height, width: `${(faded / total) * 100}%`, backgroundColor, opacity: 0.4 }} /> : null}
          <View style={{ height, flex: 1, backgroundColor }} />
        </View>
        {/* the overspend: always orange, whatever the bar's color */}
        {at !== undefined ? <View style={[styles.overPart, { left: `${clamp(at) * 100}%` }]} /> : null}
      </View>
      {at !== undefined && overWidth >= icon + ICON_ROOM ? (
        <View pointerEvents="none" style={[styles.overIcon, { top: -2, height: icon, left: `${clamp(at) * 100}%`, right: 0 }]}>
          <WarnTriangleIcon color={colors.danger} size={icon} />
        </View>
      ) : null}
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
  overPart: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: colors.warn },
  overIcon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  marker: { position: 'absolute', width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.text },
});
