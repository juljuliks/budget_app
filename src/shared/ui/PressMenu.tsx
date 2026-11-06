import React, { useRef, useState } from 'react';
import {
  AccessibilityActionEvent, GestureResponderEvent, Modal, Pressable, StatusBar, StyleProp, StyleSheet, Text, TouchableOpacity,
  useWindowDimensions, Vibration, View, ViewStyle,
} from 'react-native';
import { BUTTON_RADIUS, buttonAt, menuLayout, movedFrom, Point } from '../lib/pressMenu';
import { colors } from '../theme/theme';
import { useScrollLock } from './scrollLock';

export type PressAction = { key: string; label: string; icon: (color: string) => React.ReactNode; onPress: () => void };

type Props = {
  actions: PressAction[];
  /** a tap; none — only the long press does anything */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
  children: React.ReactNode;
};

type Open = { start: Point; buttons: Point[]; holding: boolean; moved: boolean };

// the overlay is drawn under the status bar too; the touches' pageY are from under it
const TOP_INSET = StatusBar.currentHeight ?? 0;

/**
 * A row with a long press: its actions as round buttons in an arc over the finger. Moved onto one and released — it is
 * done (the one under the finger grows, a short vibration); released away from them — nothing; released in place —
 * they stay, a tap picks one, a tap outside closes them. TalkBack: the same actions as the row's actions.
 */
export default function PressMenu({ actions, onPress, style, accessibilityHint, testID, children }: Props) {
  const { width } = useWindowDimensions();
  const lockScroll = useScrollLock();
  const [open, setOpen] = useState<Open | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // read by the touch handlers, which run between renders
  const ref = useRef<Open | null>(null);
  const hoverRef = useRef<number | null>(null);

  const close = () => { ref.current = null; hoverRef.current = null; setOpen(null); setHover(null); lockScroll(false); };
  const run = (i: number) => { close(); actions[i].onPress(); };
  const point = (e: GestureResponderEvent): Point => ({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });

  function onLongPress(e: GestureResponderEvent) {
    const start = point(e);
    ref.current = { start, buttons: menuLayout(start, actions.length, width), holding: true, moved: false };
    setOpen(ref.current);
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
    <View onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <TouchableOpacity
        style={style} onPress={onPress} onLongPress={actions.length ? onLongPress : undefined} delayLongPress={350} testID={testID}
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
    </View>
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
