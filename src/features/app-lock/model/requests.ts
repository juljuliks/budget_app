// Asking for the PIN from anywhere (like sheetAlert): who you are before turning the lock off, changing the PIN or
// showing the amounts; a new PIN, twice. LockHost shows them.
import { lockOn } from './lockStore';

export type Ask =
  /** the lock screen (it isn't asked for: shown while locked) */
  | { kind: 'unlock' }
  /** the PIN or the fingerprint; false: cancelled */
  | { kind: 'verify'; title: string; heading: string; hint?: string; resolve: (ok: boolean) => void }
  /** a new PIN, entered twice; null: cancelled */
  | { kind: 'create'; title: string; heading: string; resolve: (pin: string | null) => void };

let show: ((a: Ask) => void) | null = null;

export function attachPinHost(fn: (a: Ask) => void) { show = fn; }
export function detachPinHost() { show = null; }

/** The PIN (or the fingerprint) of the one using the app; true at once when the lock is off. */
export function verifyUser(title: string, heading: string, hint?: string): Promise<boolean> {
  if (!lockOn()) return Promise.resolve(true);
  return new Promise((resolve) => (show ? show({ kind: 'verify', title, heading, hint, resolve }) : resolve(false)));
}

/** A new PIN: "Придумайте" / "Новый", then "Подтвердите"; null when cancelled. */
export function askNewPin(title: string, heading: string): Promise<string | null> {
  return new Promise((resolve) => (show ? show({ kind: 'create', title, heading, resolve }) : resolve(null)));
}
