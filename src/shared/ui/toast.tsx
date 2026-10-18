import React, { useEffect, useRef, useState } from 'react';
import { Animated, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/theme';

/** A button in the toast: "Отменить" after deleting. */
export type ToastAction = { label: string; onPress: () => void };
type Toast = { id: number; message: string; error: boolean; action?: ToastAction; shownAt: number; duration: number };

const SHOW_MS = 2500;
const ERROR_MS = 3500;
/** with a button ("Отменить"): time to change one's mind, shown as a bar running out at the bottom */
export const ACTION_MS = 10_000;

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function show(message: string, error: boolean, action?: ToastAction) {
  const duration = action ? ACTION_MS : error ? ERROR_MS : SHOW_MS;
  current = { id: nextId++, message, error, action, shownAt: Date.now(), duration };
  emit();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, duration);
}

function hide() {
  clearTimeout(hideTimer);
  current = null;
  emit();
}

/** What an action did, at the top of the screen: "Категория «☕ Кафе» создана"; with a button ("Отменить") if given. */
export function toast(message: string, action?: ToastAction) { show(message, false, action); }

/** A problem, at the top of the screen in red: a form's rule on submit ("Введите сумму") or a failed save. */
export function toastError(message: string) { show(message, true); }

/** A `.catch` for what the user did (a switch, a sheet's data, a page of the list): logged, and said in a red toast. */
export const toastFailure = (what: string, message: string) => (e: unknown) => {
  console.error(`${what} failed`, e);
  toastError(message);
};

// Every sheet is a Modal — its own window, above the app's — so each one has a host, and only the topmost
// (the one mounted last) draws the toast; the others would be hidden under it.
const hosts: number[] = [];
let nextHost = 1;

/**
 * The place a toast is drawn: one at the app's root and one in every open sheet. `inset` is how far the window
 * starts under the status bar (a sheet's window is drawn under it).
 */
export function ToastHost({ inset = 0 }: { inset?: number }) {
  const [, rerender] = useState(0);
  const me = useRef(0);
  if (!me.current) me.current = nextHost++;
  useEffect(() => {
    const id = me.current;
    hosts.push(id);
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    emit(); // the host below stops drawing
    return () => {
      listeners.delete(l);
      hosts.splice(hosts.indexOf(id), 1);
      // the host below takes over — after this commit: told during it (a sheet closing over another one), its render
      // with the toast was dropped and it kept showing the toast before
      setTimeout(emit, 0);
    };
  }, []);

  const top = hosts[hosts.length - 1] === me.current;
  const t = top ? current : null;
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Toast | null>(null);
  useEffect(() => {
    if (t) {
      setShown(t);
      Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => { if (finished) setShown(null); });
    }
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents={shown.action ? 'box-none' : 'none'}
      style={[styles.wrap, { top: inset + 8, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}
    >
      <Animated.View style={[styles.toast, shown.error && styles.error, shown.action && styles.withAction]} accessibilityLiveRegion="polite">
        <Text style={[styles.text, shown.error && styles.errorText, shown.action && styles.textWithAction]}>
          {shown.error ? `⚠️  ${shown.message}` : shown.message}
        </Text>
        {shown.action ? (
          <TouchableOpacity onPress={() => { const a = shown.action!; hide(); a.onPress(); }} hitSlop={8} accessibilityRole="button">
            <Text style={styles.action}>{shown.action.label}</Text>
          </TouchableOpacity>
        ) : null}
        {shown.action ? <TimeLeft key={shown.id} toast={shown} /> : null}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The time left for the button, a bar at the bottom running out. From where it is now: the toast moves to the host
 * below when a sheet closes (deleted from the operation's sheet) and goes on there.
 */
function TimeLeft({ toast: t }: { toast: Toast }) {
  const left = Math.max(0, 1 - (Date.now() - t.shownAt) / t.duration);
  const part = useRef(new Animated.Value(left)).current;
  // the bar slides out to the left (a transform: on the native driver, as the toast's own fade)
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const run = Animated.timing(part, { toValue: 0, duration: left * t.duration, easing: (x) => x, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View
      style={styles.timeLeft}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="toast-time-left"
    >
      <Animated.View style={[styles.timeLeftBar, { transform: [{ translateX: part.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }] }]} />
    </View>
  );
}

/** A sheet's window starts at the very top of the screen, under the status bar. */
export const SHEET_INSET = StatusBar.currentHeight ?? 24;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  toast: {
    backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '100%',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  error: { backgroundColor: '#FEF2F2', borderWidth: 2, borderColor: colors.danger },
  text: { color: '#FFFFFF', fontSize: 15, textAlign: 'center' },
  // the whole width: the text on the left, the button at the right edge
  withAction: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 16, overflow: 'hidden', paddingBottom: 15 },
  timeLeft: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, overflow: 'hidden' },
  timeLeftBar: { flex: 1, backgroundColor: '#93C5FD' },
  textWithAction: { flex: 1, textAlign: 'left' },
  action: { color: '#93C5FD', fontSize: 15, fontWeight: '600' },
  errorText: { color: colors.danger, fontWeight: '600' },
});
