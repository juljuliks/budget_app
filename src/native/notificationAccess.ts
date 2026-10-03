import { NativeModules } from 'react-native';

// NotificationAccessModule (android/.../push): "Доступ к уведомлениям" for reading the bank app's pushes.
const native = NativeModules.NotificationAccess as
  | { isEnabled(): Promise<boolean>; openSettings(): void }
  | undefined;

export async function isPushAccessEnabled(): Promise<boolean> {
  return native ? native.isEnabled() : false;
}

export function openPushAccessSettings() {
  native?.openSettings();
}
