import { useEffect, useState } from 'react';
import { getSetting, setSetting } from '@/db/settings';

// «Зажмите категорию — …» under the month's bar: shown until a long press's button is used once. Remembered, every
// screen using it follows a change at once.

const KEY = 'row_menu_used';
let current = false;
let loaded = false;
const listeners = new Set<(v: boolean) => void>();

async function load() {
  if (loaded) return;
  loaded = true;
  const v = (await getSetting(KEY)) === '1';
  if (v !== current) {
    current = v;
    listeners.forEach((fn) => fn(v));
  }
}

/** a long press's button used (PressMenu); `false` — the hint again (tests) */
export async function setRowMenuUsed(v = true) {
  if (current === v && loaded) return;
  loaded = true;
  current = v;
  listeners.forEach((fn) => fn(v));
  await setSetting(KEY, v ? '1' : '0');
}

export function useRowMenuUsed(): boolean {
  const [v, setV] = useState(current);
  useEffect(() => {
    listeners.add(setV);
    load().catch((e) => console.error('load row menu used failed', e));
    setV(current);
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}
