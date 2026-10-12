import React, { useEffect, useState } from 'react';
import PinScreen from './PinScreen';
import { Ask, attachPinHost, detachPinHost } from '../model/requests';
import { isLocked, unlock, useLocked, watchAppState } from '../model/lockStore';
import { usePinFlow } from '../model/usePinFlow';

/**
 * The lock screen while locked, and the PIN windows asked for (verifyUser, askNewPin) — over everything; mounted once,
 * last (app/App). Starts following the app going to the background.
 */
export function LockHost() {
  const locked = useLocked();
  // a new object each time the locked app comes back: the fingerprint is asked again
  const [unlockAsk, setUnlockAsk] = useState<Ask | null>(locked ? { kind: 'unlock' } : null);
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    attachPinHost(setAsk);
    const stop = watchAppState(() => { if (isLocked()) setUnlockAsk({ kind: 'unlock' }); });
    return () => { detachPinHost(); stop(); };
  }, []);
  useEffect(() => { setUnlockAsk(locked ? { kind: 'unlock' } : null); }, [locked]);

  const asked = usePinFlow(ask, () => setAsk(null));
  const lockScreen = usePinFlow(unlockAsk, unlock);
  return (
    <>
      {asked ? <PinScreen {...asked} /> : null}
      {lockScreen ? <PinScreen {...lockScreen} /> : null}
    </>
  );
}
