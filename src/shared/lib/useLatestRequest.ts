import { useCallback, useRef } from 'react';

/**
 * Drops answers of superseded loads: switching periods quickly must not let an older, slower response overwrite
 * the newer one. Call it at the start of each load; wrap the setters of that load with the returned `keep`.
 *
 *   const latest = useLatestRequest();
 *   const load = () => { const keep = latest(); fetchStats().then(keep(setStats)); };
 */
export function useLatestRequest() {
  const id = useRef(0);
  return useCallback(() => {
    const mine = ++id.current;
    return <T,>(set: (value: T) => void) => (value: T) => { if (mine === id.current) set(value); };
  }, []);
}
