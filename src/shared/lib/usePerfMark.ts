// A mark in logcat when a screen first shows its data: "perf:<name>:<ms since epoch>" (the device's clock).
// scripts/perf.sh times the start and the screens by it (REFACTOR_PLAN.md D4); nothing else reads it. Only in a
// release build: that is what is timed (a debug one is slower anyway), and the tests' output stays clean.
import { useEffect, useRef } from 'react';

export function usePerfMark(name: string, ready: boolean) {
  const marked = useRef(false);
  useEffect(() => {
    if (__DEV__ || !ready || marked.current) return;
    marked.current = true;
    console.log(`perf:${name}:${Date.now()}`);
  }, [name, ready]);
}
