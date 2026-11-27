import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { authenticate, checkPin, lockState } from '@/native/appLock';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import type { PinScreenProps } from '../ui/PinScreen';
import type { Ask } from './requests';
import { biometricOn, pinLength as cachedPinLength } from './lockStore';
import {
  BIO_SUBTITLE,
  BY_FINGERPRINT,
  CLOSE,
  CONFIRM_PIN,
  CONFIRM_PIN_HINT,
  FORGOT,
  FORGOT_INFO,
  FORGOT_INFO_BIO,
  NEW_PIN_HINT,
  PIN_MISMATCH,
  RESTART_PIN,
  UNLOCK_TITLE,
  USE_PIN,
  ENTER_PIN,
  waitPin,
  wrongPin,
} from '../texts';

/**
 * What the PIN window shows for an ask, and what its keys do: a PIN checked (the attempts left, the wait after too
 * many), the fingerprint asked at once when it is on, a new PIN entered twice. `done` ends the ask.
 */
export function usePinFlow(ask: Ask | null, done: () => void): (PinScreenProps & { visible: boolean }) | null {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [wait, setWait] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [pinLength, setPinLength] = useState(cachedPinLength);
  const busy = useRef(false);

  const pass = () => {
    if (ask?.kind === 'verify') ask.resolve(true);
    done();
  };
  const biometric = async () => {
    if (!ask || ask.kind === 'create' || !biometricOn() || busy.current) return;
    // locked on leaving ("Всегда"): asked when the app is back (LockHost renews the ask), not into the background
    if (AppState.currentState === 'background') return;
    busy.current = true;
    const title = ask.kind === 'unlock' ? UNLOCK_TITLE : ask.title;
    const r = await authenticate(title, BIO_SUBTITLE, USE_PIN).finally(() => {
      busy.current = false;
    });
    if (r === 'ok') pass();
  };

  useEffect(() => {
    setFirst(null);
    setError(undefined);
    setWait(0);
    if (!ask || ask.kind === 'create') return;
    lockState()
      .then((s) => {
        setPinLength(s.pinLength);
        if (s.waitS > 0) setWait(s.waitS);
      })
      .catch((e) => console.error('lock state failed', e));
    biometric().catch((e) => console.error('biometric failed', e));
  }, [ask]); // eslint-disable-line react-hooks/exhaustive-deps

  // the wait after too many wrong PINs, counted down
  useEffect(() => {
    if (wait <= 0) return;
    setError(waitPin(wait));
    const t = setTimeout(() => {
      setWait(wait - 1);
      if (wait === 1) setError(undefined);
    }, 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (!ask) return null;
  const again = (message: string) => {
    setError(message);
    setResetKey((k) => k + 1);
  };

  if (ask.kind === 'create') return createScreen(ask, { first, setFirst, error, setError, resetKey, again, done });

  const onSubmit = async (pin: string) => {
    const r = await checkPin(pin);
    if (r.ok) return pass();
    if (r.waitS > 0) {
      setResetKey((k) => k + 1);
      setWait(r.waitS);
    } else again(wrongPin(r.left));
  };
  return {
    visible: true,
    resetKey,
    error,
    length: pinLength,
    disabled: wait > 0,
    title: ask.kind === 'verify' ? ask.title : undefined,
    heading: ask.kind === 'verify' ? ask.heading : ENTER_PIN,
    hint: ask.kind === 'verify' ? ask.hint : undefined,
    onSubmit: (pin) => {
      onSubmit(pin).catch((e) => console.error('PIN check failed', e));
    },
    onCancel:
      ask.kind === 'verify'
        ? () => {
            ask.resolve(false);
            done();
          }
        : undefined,
    onBiometric: biometricOn()
      ? () => {
          biometric().catch((e) => console.error('biometric failed', e));
        }
      : undefined,
    link: ask.kind === 'unlock' ? { title: FORGOT, onPress: () => askForgot(biometric) } : undefined,
  };
}

type CreateState = {
  first: string | null;
  setFirst: (pin: string | null) => void;
  error: string | undefined;
  setError: (e: string | undefined) => void;
  resetKey: number;
  again: (message: string) => void;
  done: () => void;
};

/** A new PIN: entered, then again; a mismatch — "Ввести заново". */
function createScreen(
  ask: Extract<Ask, { kind: 'create' }>,
  { first, setFirst, error, setError, resetKey, again, done }: CreateState,
): PinScreenProps & { visible: boolean } {
  const cancel = () => {
    ask.resolve(null);
    done();
  };
  return {
    visible: true,
    title: ask.title,
    resetKey,
    error,
    heading: first === null ? ask.heading : CONFIRM_PIN,
    hint: first === null ? NEW_PIN_HINT : CONFIRM_PIN_HINT,
    length: first === null ? null : first.length,
    onCancel: cancel,
    onSubmit: (pin) => {
      if (first === null) {
        setFirst(pin);
        setError(undefined);
        return;
      }
      if (pin === first) {
        ask.resolve(pin);
        done();
        return;
      }
      again(PIN_MISMATCH);
    },
    link:
      first !== null && error
        ? {
            title: RESTART_PIN,
            onPress: () => {
              setFirst(null);
              setError(undefined);
            },
          }
        : undefined,
  };
}

/** "Забыли PIN?": what to do; with the fingerprint on — unlock by it. */
function askForgot(biometric: () => Promise<void>) {
  sheetAlert(
    FORGOT,
    biometricOn() ? FORGOT_INFO_BIO : FORGOT_INFO,
    biometricOn()
      ? [
          {
            text: BY_FINGERPRINT,
            onPress: () => {
              biometric().catch((e) => console.error('biometric failed', e));
            },
          },
          { text: CLOSE, style: 'cancel' },
        ]
      : [{ text: CLOSE, style: 'cancel' }],
  );
}
