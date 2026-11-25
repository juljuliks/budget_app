import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BUTTON_RADIUS, CROSS, crossPath, LABEL_GAP, LABEL_H, LABEL_W, PLATE_PAD, Point } from '../lib/pressMenu';
import { colors } from '../theme/theme';
import { font, weight } from '../theme/tokens';

export type DPadAction = { key: string; label: string; icon: (color: string) => React.ReactNode };

type Props = {
  /** left, top, right, bottom */
  actions: DPadAction[];
  /** the buttons' centers (menuLayout), on the screen */
  buttons: Point[];
  /** the button under the finger: grows, filled */
  hover: number | null;
  /** how far down the overlay's points are drawn (under the status bar) */
  top: number;
  onPress: (i: number) => void;
};

const R = BUTTON_RADIUS;
/** the plate's bars: as thick as a circle with its padding, their ends half circles */
const HALF = R + PLATE_PAD;
// frosted: the page's white, see-through, a fine light edge (no blur: the menu is a window of its own, and Android can't
// blur what another window draws)
const PLATE_FILL = colors.glassFill;
const PLATE_EDGE = colors.glassEdge;
/** the one under the finger grows this much: still clear of its neighbours */
const GROW = 1.15;

/**
 * Four actions of a long press: round buttons close around the finger, left, top, right, bottom, on a frosted
 * plate of the cross's shape; each label outside, beyond its button. The one under the finger grows and fills; a tap
 * picks one.
 */
export default function DPad({ actions, buttons, hover, top, onPress }: Props) {
  const c = { x: buttons[1].x, y: buttons[0].y + top };
  return (
    <>
      {/* the plate: one cross-shaped outline, its arms' ends round */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Path
            d={crossPath(c.x, c.y, {
              w: CROSS + HALF,
              h: HALF,
              up: HALF,
              down: HALF,
              vUp: CROSS + HALF,
              vDown: CROSS + HALF,
              r: HALF,
              ri: CROSS - HALF,
            })}
            fill={PLATE_FILL}
            stroke={PLATE_EDGE}
            strokeWidth={1}
          />
        </Svg>
      </View>
      {buttons.map((b, i) => {
        const on = hover === i;
        const r = on ? R * GROW : R;
        return (
          <TouchableOpacity
            key={actions[i].key}
            onPress={() => onPress(i)}
            accessibilityRole="button"
            accessibilityLabel={actions[i].label}
            style={[
              styles.circle,
              { left: b.x - r, top: b.y + top - r, width: r * 2, height: r * 2, borderRadius: r },
              on && styles.circleOn,
            ]}
          >
            {actions[i].icon(on ? colors.onAccent : colors.accent)}
          </TouchableOpacity>
        );
      })}
      {/* the labels don't take the touches: a tap there is outside (closes the menu) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {buttons.map((b, i) => (
          <Text
            key={`l-${actions[i].key}`}
            numberOfLines={1}
            style={[styles.label, hover === i && styles.labelOn, labelAt(i, b, top)]}
          >
            {actions[i].label}
          </Text>
        ))}
      </View>
    </>
  );
}

/** a label beyond its button: left of the left one, over the top one, right of the right one, under the bottom one */
function labelAt(i: number, b: Point, top: number) {
  const y = b.y + top;
  const d = R + LABEL_GAP;
  if (i === 0) return { left: b.x - d - LABEL_W, top: y - LABEL_H / 2, width: LABEL_W, textAlign: 'right' as const };
  if (i === 2) return { left: b.x + d, top: y - LABEL_H / 2, width: LABEL_W, textAlign: 'left' as const };
  return {
    left: b.x - LABEL_W,
    top: i === 1 ? y - d - LABEL_H : y + d,
    width: LABEL_W * 2,
    textAlign: 'center' as const,
  };
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  circleOn: { backgroundColor: colors.accent },
  // on the dimmed screen, outside the plate: white with a shadow, as the arc's labels
  label: {
    position: 'absolute',
    height: LABEL_H,
    lineHeight: LABEL_H,
    fontSize: font.meta,
    fontWeight: weight.semibold,
    color: colors.onAccent,
    textShadowColor: colors.textShadow,
    textShadowRadius: 3,
  },
  labelOn: { fontSize: font.secondary, fontWeight: weight.bold },
});
