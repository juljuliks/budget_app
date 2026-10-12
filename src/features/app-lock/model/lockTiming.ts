/**
 * Is the PIN asked on coming back: the lock on and the app was in the background at least `delayS` ("Спрашивать после
 * сворачивания"; 0 — "Всегда").
 */
export function shouldLock(pin: boolean, delayS: number, backgroundAt: number | null, now: number): boolean {
  return pin && backgroundAt !== null && now - backgroundAt >= delayS * 1000;
}
