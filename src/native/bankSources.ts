import { NativeModules } from 'react-native';

// BankSourcesModule (android/.../sms/BankSources.kt): which banks' SMS and pushes the native side lets through. Kept
// there too: an SMS comes while the app (and its database) is closed.
const native = NativeModules.BankSources as { setEnabled(ids: string[]): void } | undefined;

/** The banks on, for the receiver, the push listener and the SMS import; nothing without the native module (tests). */
export function setNativeBanks(ids: string[]): void {
  native?.setEnabled(ids);
}
