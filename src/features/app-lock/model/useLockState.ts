import { useCallback, useEffect, useState } from 'react';
import { LockState, lockState } from '@/native/appLock';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED, SAVE_FAILED } from '@/shared/lib/strings';

/**
 * The lock's settings as saved, read when `open`; `run` does a step and reads them again (done or cancelled, the
 * switches show what is saved); `set` shows a change before it is saved.
 */
export function useLockState(open: boolean) {
  const [s, setS] = useState<LockState | null>(null);
  const reload = useCallback(() => { lockState().then(setS).catch(toastFailure('load lock state', LOAD_FAILED)); }, []);
  useEffect(() => { if (open) reload(); }, [open, reload]);
  const run = (step: Promise<unknown>) => { step.catch(toastFailure('save lock', SAVE_FAILED)).finally(reload); };
  const set = (patch: Partial<LockState>) => setS((cur) => (cur ? { ...cur, ...patch } : cur));
  return { s, run, set };
}
