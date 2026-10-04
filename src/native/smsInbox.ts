import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

// SmsInboxModule (android/.../sms): the bank's SMS already in the phone, for "Импорт SMS" in settings.
export type InboxSms = { sender: string; body: string; date: number; dateSent: number };

const native = NativeModules.SmsInbox as { readBankSms(sinceMs: number): Promise<InboxSms[]> } | undefined;

/** Asks for READ_SMS (only when the user starts an import); false if refused or not Android. */
export async function requestInboxAccess(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native) return false;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

/** The bank's SMS received since `sinceMs`, oldest first. */
export async function readBankSms(sinceMs: number): Promise<InboxSms[]> {
  if (!native) return [];
  return native.readBankSms(sinceMs);
}
