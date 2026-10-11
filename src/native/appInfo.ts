import { NativeModules } from 'react-native';

// AppInfoModule (android/.../AppInfoModule.kt): this build's version, shown in the settings.
const native = NativeModules.AppInfo as { versionName: string; versionCode: number } | undefined;

/** "1.0.42" (a CI build), "1.0-dev" (a local one); "dev" without the native module (tests). */
export function appVersion(): string {
  return native?.versionName ?? 'dev';
}
