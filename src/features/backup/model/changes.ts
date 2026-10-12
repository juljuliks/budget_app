// The backup sheet's switches follow the settings: turning the automatic copy or the password on or off says so here.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onBackupSettingsChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function backupSettingsChanged() {
  listeners.forEach((fn) => fn());
}
