import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * The same function on every render, calling the latest `fn`: a handler passed to memoized list rows doesn't redraw
 * them all when the screen renders. Not for calling during render (it sees the previous render's `fn` there).
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => { ref.current = fn; });
  return useCallback((...args: A) => ref.current(...args), []);
}
