import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '@/db/settings';

/**
 * A hint shown until what it explains is used once («Зажмите категорию — …», «Зажмите операцию — …»). Remembered in the
 * settings; every screen using it follows a change at once.
 */
export function usedOnce(key: string) {
  let current = false;
  let loaded = false;
  const listeners = new Set<(v: boolean) => void>();

  async function load() {
    if (loaded) return;
    loaded = true;
    const v = (await getSetting(key)) === '1';
    if (v !== current) {
      current = v;
      listeners.forEach((fn) => fn(v));
    }
  }

  /** used; `false` — the hint again (tests) */
  async function set(v = true) {
    if (current === v && loaded) return;
    loaded = true;
    current = v;
    listeners.forEach((fn) => fn(v));
    await setSetting(key, v ? '1' : '0');
  }

  function useUsed(): boolean {
    const [v, setV] = useState(current);
    useEffect(() => {
      listeners.add(setV);
      load().catch((e) => console.error(`load ${key} failed`, e));
      setV(current);
      return () => {
        listeners.delete(setV);
      };
    }, []);
    return v;
  }

  return { set, useUsed };
}
