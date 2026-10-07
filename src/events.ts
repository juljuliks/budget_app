// Tiny in-process pub/sub so screens can refresh when data changes elsewhere
// (headless SMS task and notification actions run in the same JS context while the app is alive).
// Also emitted when a category's plan amount is saved: the stats and reports count it.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onTransactionsChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitTransactionsChanged() {
  listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error('transactions listener failed', e); }
  });
}
