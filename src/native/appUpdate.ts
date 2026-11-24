import { NativeEventEmitter, NativeModules } from 'react-native';

// AppUpdateModule (android/.../update): a newer release's APK downloaded and handed to the system installer.
type Native = {
  download(url: string): Promise<string>;
  canInstall(): Promise<boolean>;
  openInstallSettings(): void;
  install(path: string): Promise<void>;
  takeLaunchAction(): Promise<string | null>;
  markOffered(version: string): void;
};
const native = NativeModules.AppUpdate as Native | undefined;

/** Whether this build can update itself (the native module is there: not in tests). */
export const canSelfUpdate = () => native != null;

/** The APK into the app's cache; `onProgress` 0..100 (-1: the size isn't known). Resolves with the file's path. */
export async function downloadApk(url: string, onProgress: (percent: number) => void): Promise<string> {
  if (!native) throw new Error('AppUpdate native module is missing');
  const sub = new NativeEventEmitter(NativeModules.AppUpdate).addListener('AppUpdateProgress', (e: { percent: number }) => onProgress(e.percent));
  try {
    return await native.download(url);
  } finally {
    sub.remove();
  }
}

/** Android's "install unknown apps" for this app is on. */
export async function canInstallApps(): Promise<boolean> {
  return native ? native.canInstall() : false;
}

export function openInstallSettings() {
  native?.openInstallSettings();
}

/** The system installer over the app: "Обновить?" — the data stays. */
export async function installApk(path: string): Promise<void> {
  if (!native) throw new Error('AppUpdate native module is missing');
  await native.install(path);
}

/** Opened by the update's notification (the daily check, UpdateCheckWorker): true once. */
export async function openedForUpdate(): Promise<boolean> {
  return native ? (await native.takeLaunchAction()) === 'update' : false;
}

/** A version said by the toast: the daily check won't notify about it. */
export function markUpdateOffered(version: string) {
  native?.markOffered(version);
}
