import { useCallback, useState } from 'react';

/**
 * A screen's load that failed: logged, and kept until the next load starts. While the screen has nothing to show,
 * it says so with "Повторить" (shared/ui/Loading) instead of spinning forever.
 *
 *   const { failed, started, fail } = useLoadFailed('load stats');
 *   const load = () => { started(); fetchStats().then(setStats).catch(fail); };
 */
export function useLoadFailed(what: string) {
  const [failed, setFailed] = useState(false);
  const started = useCallback(() => setFailed(false), []);
  const fail = useCallback((e: unknown) => {
    console.error(`${what} failed`, e);
    setFailed(true);
  }, [what]);
  return { failed, started, fail };
}
