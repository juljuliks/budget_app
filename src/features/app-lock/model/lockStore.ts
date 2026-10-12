// Is the app locked now: on start with a PIN set, and after it stayed in the background longer than "Спрашивать после
// сворачивания". The settings it needs are cached here, so the lock screen is up before the app's content shows.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { shouldLock } from './lockTiming';
import { biometricOnStart, DEFAULT_DELAY_S, isOutside, lockedOnStart, lockState } from '@/native/appLock';


const cache = { pin: lockedOnStart(), delayS: DEFAULT_DELAY_S, biometric: biometricOnStart(), pinLength: 4 };
let locked = cache.pin;
let backgroundAt: number | null = null;
const listeners = new Set<(v: boolean) => void>();

function setLocked(v: boolean) {
  if (v === locked) return;
  locked = v;
  listeners.forEach((fn) => fn(v));
}

/** Re-reads the settings (on start and after each change of them). */
export async function refreshLock() {
  const s = await lockState();
  Object.assign(cache, { pin: s.pin, delayS: s.delayS, biometric: s.biometric, pinLength: s.pinLength });
  if (!s.pin) setLocked(false);
}

export const lockOn = () => cache.pin;
export const biometricOn = () => cache.biometric;
export const pinLength = () => cache.pinLength;
export const unlock = () => setLocked(false);

/** Follows the app going to the background and back; returns the stop. */
export function watchAppState(onActive: () => void): () => void {
  refreshLock().catch((e) => console.error('lock state failed', e));
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'background') {
      // a system window over the app (a file picker, the fingerprint) isn't leaving it
      if (isOutside()) return;
      backgroundAt = Date.now();
      // "Сразу": locked already, nothing shows for a moment on coming back
      if (shouldLock(cache.pin, cache.delayS, backgroundAt, backgroundAt)) setLocked(true);
    } else if (s === 'active') {
      if (shouldLock(cache.pin, cache.delayS, backgroundAt, Date.now())) setLocked(true);
      backgroundAt = null;
      onActive();
    }
  });
  return () => sub.remove();
}

export function useLocked(): boolean {
  const [v, setV] = useState(locked);
  useEffect(() => {
    listeners.add(setV);
    setV(locked);
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}

export const isLocked = () => locked;
