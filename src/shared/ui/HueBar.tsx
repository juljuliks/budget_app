import React, { useState } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colorFromHue } from '@/colors';
import { colors } from '../theme/theme';

const HEIGHT = 28;
const STOPS = [0, 60, 120, 180, 240, 300, 360];

/** Rainbow bar: tap or drag to pick a hue (0..360); the picked one is marked with a ring. */
export default function HueBar({ hue, onChange }: { hue: number | null; onChange: (hue: number) => void }) {
  const [width, setWidth] = useState(0);

  function pick(e: GestureResponderEvent) {
    if (width <= 0) return;
    const x = Math.max(0, Math.min(width, e.nativeEvent.locationX));
    onChange(Math.round((x / width) * 359));
  }

  return (
    <View
      style={styles.bar}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      // the bar takes the gesture from the scroll view while dragging along it
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={pick}
      onResponderMove={pick}
      accessibilityLabel="Выбор цвета"
    >
      {width > 0 ? (
        <Svg width={width} height={HEIGHT} pointerEvents="none">
          <Defs>
            <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
              {STOPS.map((h) => <Stop key={h} offset={h / 360} stopColor={colorFromHue(h % 360)} />)}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={HEIGHT} rx={HEIGHT / 2} fill="url(#hue)" />
        </Svg>
      ) : null}
      {hue !== null && width > 0 ? (
        <View pointerEvents="none" style={[styles.marker, { left: (hue / 359) * width - (HEIGHT + 6) / 2, backgroundColor: colorFromHue(hue) }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: HEIGHT, marginVertical: 6 },
  marker: {
    position: 'absolute', top: -3, width: HEIGHT + 6, height: HEIGHT + 6, borderRadius: (HEIGHT + 6) / 2,
    borderWidth: 3, borderColor: colors.bg, elevation: 3,
  },
});
