import { useCallback, useEffect, useState } from 'react';
import { getSetting, setSetting } from '../db/settings';

// Folded blocks ("Лимиты"): which are folded, remembered per screen
// ('plan', 'stats', …) in the settings. Every screen using a scope follows a change at once.

const cache = new Map<string, Set<string>>();
const listeners = new Map<string, Set<(s: Set<string>) => void>>();
const keyOf = (scope: string) => `folded_${scope}`;

async function load(scope: string): Promise<Set<string>> {
  const hit = cache.get(scope);
  if (hit) return hit;
  let set = new Set<string>();
  try {
    const v = await getSetting(keyOf(scope));
    if (v) set = new Set(JSON.parse(v) as string[]);
  } catch (e) {
    console.error('load folded sections failed', e);
  }
  cache.set(scope, set);
  return set;
}

/** The folded sections of `scope`: is(key) and toggle(key); `defaults` are folded until the user unfolds them. */
export function useFolded(scope: string, defaults: string[] = []) {
  const [folded, setFolded] = useState<Set<string> | null>(cache.get(scope) ?? null);
  useEffect(() => {
    const ls = listeners.get(scope) ?? new Set();
    listeners.set(scope, ls);
    ls.add(setFolded);
    load(scope).then(setFolded);
    return () => { ls.delete(setFolded); };
  }, [scope]);
  // a default-folded key is stored as "!key" once unfolded
  const is = useCallback((key: string) => {
    const s = folded ?? new Set<string>();
    return defaults.includes(key) ? !s.has(`!${key}`) : s.has(key);
  }, [folded, defaults]);
  const toggle = useCallback((key: string) => {
    const s = new Set(cache.get(scope) ?? []);
    const k = defaults.includes(key) ? `!${key}` : key;
    if (s.has(k)) s.delete(k); else s.add(k);
    cache.set(scope, s);
    listeners.get(scope)?.forEach((fn) => fn(s));
    setSetting(keyOf(scope), JSON.stringify([...s])).catch((e) => console.error('save folded sections failed', e));
  }, [scope, defaults]);
  return { is, toggle };
}
