import React, { useRef, useState } from 'react';
import {
  AccessibilityActionEvent, Animated, Easing, GestureResponderEvent, Modal, Pressable, StatusBar, StyleProp, StyleSheet, Text, TouchableOpacity,
  useWindowDimensions, Vibration, View, ViewStyle,
} from 'react-native';
import { BUTTON_RADIUS, buttonAt, menuLayout, movedFrom, Point } from '../lib/pressMenu';
import { colors } from '../theme/theme';
import { useScrollLock } from './scrollLock';

export type PressAction = { key: string; label: string; icon: (color: string) => React.ReactNode; onPress: () => void };

type Props = {
  actions: PressAction[];
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
  children: React.ReactNode;
};

type Open = { start: Point; buttons: Point[]; holding: boolean; moved: boolean };

// the overlay is drawn under the status bar too; the touches' pageY are from under it
const TOP_INSET = StatusBar.currentHeight ?? 0;
const LONG_PRESS = 350;
// a scroll's first move doesn't press the row: it isn't pressed (nor shrinks) before this
const PRESS_DELAY = 120;
// held, the row shrinks to this by the long press: holding it does something
const HELD_SCALE = 0.96;

/**
 * A row with a long press: its actions as round buttons in an arc over the finger. Moved onto one and released — it is
 * done (the one under the finger grows, a short vibration); released away from them — nothing; released in place —
 * they stay, a tap picks one, a tap outside closes them. A tap opens them too, where it was; held, the row shrinks
 * towards the long press. TalkBack: the same actions as the row's actions.
 */
export default function PressMenu({ actions, style, accessibilityHint, testID, children }: Props) {
  const { width } = useWindowDimensions();
  const lockScroll = useScrollLock();
  const [open, setOpen] = useState<Open | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // read by the touch handlers, which run between renders
  const ref = useRef<Open | null>(null);
  const hoverRef = useRef<number | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const shrink = () => Animated.timing(scale, {
    toValue: HELD_SCALE, duration: LONG_PRESS - PRESS_DELAY, easing: Easing.out(Easing.quad), useNativeDriver: true,
  }).start();
  const restore = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  const close = () => { ref.current = null; hoverRef.current = null; setOpen(null); setHover(null); lockScroll(false); };
  const run = (i: number) => { close(); actions[i].onPress(); };
  const point = (e: GestureResponderEvent): Point => ({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });

  function show(e: GestureResponderEvent, holding: boolean) {
    // no touch point (TalkBack's tap): the middle of the screen
    const start = e?.nativeEvent?.pageX !== undefined ? point(e) : { x: width / 2, y: 400 };
    ref.current = { start, buttons: menuLayout(start, actions.length, width), holding, moved: false };
    setOpen(ref.current);
    restore();
  }
  function onLongPress(e: GestureResponderEvent) {
    show(e, true);
    // the list must not take the drag towards the buttons
    lockScroll(true);
    Vibration.vibrate(15);
  }
  function onTouchMove(e: GestureResponderEvent) {
    const o = ref.current;
    if (!o?.holding) return;
    const p = point(e);
    if (movedFrom(p, o.start)) o.moved = true;
    const i = buttonAt(o.buttons, p);
    if (i === hoverRef.current) return;
    hoverRef.current = i;
    setHover(i);
    if (i !== null) Vibration.vibrate(10);
  }
  function onTouchEnd() {
    const o = ref.current;
    if (!o?.holding) return;
    o.holding = false;
    lockScroll(false);
    // released in place: the buttons stay for a tap
    if (!o.moved) return;
    if (hoverRef.current !== null) run(hoverRef.current);
    else close();
  }
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const a = actions.find((x) => x.key === e.nativeEvent.actionName);
    if (a) a.onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <TouchableOpacity
        style={style} activeOpacity={1} disabled={!actions.length} testID={testID}
        onPress={(e) => show(e, false)} onLongPress={onLongPress} delayPressIn={PRESS_DELAY} delayLongPress={LONG_PRESS}
        onPressIn={shrink} onPressOut={restore}
        accessibilityHint={accessibilityHint}
        accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
        onAccessibilityAction={onAccessibilityAction}
      >
        {children}
      </TouchableOpacity>
      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Закрыть" />
        {open?.buttons.map((b, i) => {
          const on = hover === i;
          const r = on ? BUTTON_RADIUS * 1.3 : BUTTON_RADIUS;
          return (
            <TouchableOpacity
              key={actions[i].key} onPress={() => run(i)} accessibilityRole="button" accessibilityLabel={actions[i].label}
              style={[styles.button, { left: b.x - 40, top: b.y + TOP_INSET - r }]}
            >
              <View style={[styles.circle, { width: r * 2, height: r * 2, borderRadius: r }, on && styles.circleOn]}>
                {actions[i].icon(on ? colors.onAccent : colors.accent)}
              </View>
              <Text style={[styles.label, on && styles.labelOn]}>{actions[i].label}</Text>
            </TouchableOpacity>
          );
        })}
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(22,24,29,0.28)' },
  // 80 wide: the label fits under the circle
  button: { position: 'absolute', width: 80, alignItems: 'center', gap: 4 },
  circle: {
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  circleOn: { backgroundColor: colors.accent },
  label: { fontSize: 13, fontWeight: '600', color: colors.onAccent, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  labelOn: { fontSize: 14, fontWeight: '700' },
});
