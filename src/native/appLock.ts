import { NativeModules } from 'react-native';

// AppLockModule (android/.../lock): "Блокировка" — the PIN kept and checked natively (a salted PBKDF2 hash, apart from
// the database), the system fingerprint window. Without the native module (tests) it is kept in memory.

export type LockState = {
  pin: boolean;
  pinLength: number;
  biometric: boolean;
  /** a sensor with a finger or face enrolled */
  biometricAvailable: boolean;
  /** how long the app may stay in the background before the PIN is asked again */
  delayS: number;
  hideNotifications: boolean;
  /** seconds to wait after too many wrong PINs */
  waitS: number;
};
export type PinCheck = { ok: boolean; left: number; waitS: number };
/** 'pin': "Ввести PIN-код" pressed; 'error': no sensor or too many tries */
export type BiometricResult = 'ok' | 'pin' | 'cancel' | 'error';

type Native = {
  pin: boolean;
  biometric: boolean;
  getState(): Promise<LockState>;
  setPin(pin: string | null): Promise<boolean>;
  checkPin(pin: string): Promise<PinCheck>;
  setBiometric(on: boolean): Promise<boolean>;
  setDelay(seconds: number): Promise<boolean>;
  setHideNotifications(on: boolean): Promise<boolean>;
  authenticate(title: string, subtitle: string, negative: string): Promise<BiometricResult>;
};

/** "Всегда": the PIN on every coming back */
export const DEFAULT_DELAY_S = 0;
const ATTEMPTS = 5;

/** System windows open over the app now (whileOutside), and until when the app counts as just back from one. */
let outside = 0;
let backUntil = 0;

/** In memory, for tests: the same rules, no hashing. `biometricAvailable` and `nextBiometric` set by a test, `asked` counts the fingerprint windows. */
export const memoryLock = {
  pin: null as string | null, biometric: false, delayS: DEFAULT_DELAY_S, hideNotifications: false, failures: 0,
  biometricAvailable: false, nextBiometric: 'ok' as BiometricResult, asked: 0,
  reset() {
    Object.assign(memoryLock, { pin: null, biometric: false, delayS: DEFAULT_DELAY_S, hideNotifications: false, failures: 0, biometricAvailable: false, nextBiometric: 'ok', asked: 0 });
    outside = 0;
    backUntil = 0;
  },
};

const memory: Native = {
  get pin() { return memoryLock.pin !== null; },
  get biometric() { return memoryLock.biometric; },
  getState: async () => ({
    pin: memoryLock.pin !== null, pinLength: memoryLock.pin?.length ?? 0, biometric: memoryLock.biometric,
    biometricAvailable: memoryLock.biometricAvailable, delayS: memoryLock.delayS, hideNotifications: memoryLock.hideNotifications, waitS: 0,
  }),
  setPin: async (pin) => {
    if (pin === null) memoryLock.reset();
    else Object.assign(memoryLock, { pin, failures: 0 });
    return true;
  },
  checkPin: async (pin) => {
    if (pin === memoryLock.pin) { memoryLock.failures = 0; return { ok: true, left: ATTEMPTS, waitS: 0 }; }
    memoryLock.failures += 1;
    if (memoryLock.failures >= ATTEMPTS) { memoryLock.failures = 0; return { ok: false, left: 0, waitS: 30 }; }
    return { ok: false, left: ATTEMPTS - memoryLock.failures, waitS: 0 };
  },
  setBiometric: async (on) => { memoryLock.biometric = on; return true; },
  setDelay: async (s) => { memoryLock.delayS = s; return true; },
  setHideNotifications: async (on) => { memoryLock.hideNotifications = on; return true; },
  authenticate: async () => { memoryLock.asked += 1; return memoryLock.nextBiometric; },
};

const native = (NativeModules.AppLock as Native | undefined) ?? memory;

/** On start, before any promise: is the PIN set (the lock screen is the first thing shown). */
export const lockedOnStart = () => native.pin;
export const biometricOnStart = () => native.biometric;

export const lockState = () => native.getState();
/** A new PIN (the lock on); null: the lock off, its settings forgotten. */
export const setPin = (pin: string | null) => native.setPin(pin);
export const checkPin = (pin: string) => native.checkPin(pin);
export const setBiometric = (on: boolean) => native.setBiometric(on);
export const setLockDelay = (seconds: number) => native.setDelay(seconds);
export const setHideNotifications = (on: boolean) => native.setHideNotifications(on);

/** "Скрывать суммы в уведомлениях" (read by the notifications, false without the lock). */
export async function hideNotificationAmounts(): Promise<boolean> {
  const s = await native.getState();
  return s.pin && s.hideNotifications;
}

/**
 * While a window of the system is open over the app (a file picker, a permission, the fingerprint window), going to
 * the background isn't leaving the app: the lock doesn't count that time.
 */
export async function whileOutside<T>(run: () => Promise<T>): Promise<T> {
  outside += 1;
  try {
    return await run();
  } finally {
    outside -= 1;
    // the app comes back ("active") a moment after the result
    backUntil = Date.now() + 1000;
  }
}

export const isOutside = () => outside > 0 || Date.now() < backUntil;

/** The system fingerprint / face window. */
export const authenticate = (title: string, subtitle: string, negative: string) =>
  whileOutside(() => native.authenticate(title, subtitle, negative));
