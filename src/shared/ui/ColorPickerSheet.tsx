import React, { useEffect, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { hexToHsv, hsvToHex } from '@/colors';
import BottomSheet from './BottomSheet';
import { SheetActions } from './Button';
import HueBar from './HueBar';
import { colors } from '../theme/theme';

const SQUARE = 200;
const MARK = 26;

type Props = {
  visible: boolean;
  title?: string;
  /** the color to start from (null: a mid blue) */
  value: string | null;
  onPick: (hex: string) => void;
  onClose: () => void;
};

/**
 * "Свой цвет": a saturation (left → right) / brightness (top → bottom) square over a hue picked on the rainbow
 * bar, with the result shown before it is taken. Used for a category's color and a section's palette.
 */
export default function ColorPickerSheet({ visible, title = 'Свой цвет', value, onPick, onClose }: Props) {
  const [hsv, setHsv] = useState<[number, number, number]>([220, 70, 80]);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (visible) setHsv(value ? hexToHsv(value) : [220, 70, 80]);
  }, [visible, value]);
  const [h, s, v] = hsv;
  const hex = hsvToHex(h, s, v);

  function pickSv(e: GestureResponderEvent) {
    if (width <= 0) return;
    const x = Math.max(0, Math.min(width, e.nativeEvent.locationX));
    const y = Math.max(0, Math.min(SQUARE, e.nativeEvent.locationY));
    setHsv([h, (x / width) * 100, 100 - (y / SQUARE) * 100]);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <View
          style={styles.square}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          // dragging inside the square isn't a swipe of the sheet
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={pickSv}
          onResponderMove={pickSv}
          accessibilityLabel="Насыщенность и яркость"
        >
          {width > 0 ? (
            <Svg width={width} height={SQUARE} pointerEvents="none">
              <Defs>
                <LinearGradient id="sat" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset={0} stopColor="#FFFFFF" stopOpacity={1} />
                  <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id="val" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset={0} stopColor="#000000" stopOpacity={0} />
                  <Stop offset={1} stopColor="#000000" stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={width} height={SQUARE} rx={12} fill={hsvToHex(h, 100, 100)} />
              <Rect x={0} y={0} width={width} height={SQUARE} rx={12} fill="url(#sat)" />
              <Rect x={0} y={0} width={width} height={SQUARE} rx={12} fill="url(#val)" />
            </Svg>
          ) : null}
          {width > 0 ? (
            <View
              pointerEvents="none"
              style={[styles.mark, { left: (s / 100) * width - MARK / 2, top: (1 - v / 100) * SQUARE - MARK / 2, backgroundColor: hex }]}
            />
          ) : null}
        </View>
        <HueBar hue={Math.round(h)} onChange={(hue) => setHsv([hue, s, v])} />
        <View style={styles.previewRow}>
          <View style={[styles.preview, { backgroundColor: hex }]} />
          <Text style={styles.hex}>{hex.toUpperCase()}</Text>
        </View>
        <SheetActions submit={{ title: 'Выбрать', onPress: () => { onPick(hex); onClose(); } }} onCancel={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  square: { height: SQUARE, marginTop: 4, marginBottom: 10 },
  mark: { position: 'absolute', width: MARK, height: MARK, borderRadius: MARK / 2, borderWidth: 3, borderColor: '#FFFFFF', elevation: 3 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  preview: { width: 40, height: 40, borderRadius: 20 },
  hex: { fontSize: 15, color: colors.muted },
});
