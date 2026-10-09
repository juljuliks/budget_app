import React, { useEffect, useRef, useState } from 'react';
import { Animated, StatusBar, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/theme';

type Toast = { id: number; message: string; error: boolean };

const SHOW_MS = 2500;
const ERROR_MS = 3500;

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function show(message: string, error: boolean) {
  current = { id: nextId++, message, error };
  emit();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { current = null; emit(); }, error ? ERROR_MS : SHOW_MS);
}

/** What an action did, at the top of the screen: "Категория «☕ Кафе» создана". */
export function toast(message: string) { show(message, false); }

/** A problem, at the top of the screen in red: a form's rule on submit ("Введите сумму") or a failed save. */
export function toastError(message: string) { show(message, true); }

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
      emit(); // the host below takes over
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
      pointerEvents="none"
      style={[styles.wrap, { top: inset + 8, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}
    >
      <Animated.View style={[styles.toast, shown.error && styles.error]} accessibilityLiveRegion="polite">
        <Text style={[styles.text, shown.error && styles.errorText]}>{shown.error ? `⚠️  ${shown.message}` : shown.message}</Text>
      </Animated.View>
    </Animated.View>
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
  errorText: { color: colors.danger, fontWeight: '600' },
});
