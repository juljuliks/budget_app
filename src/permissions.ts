import { PermissionsAndroid, Platform } from 'react-native';

export type PermissionStatus = {
  sms: boolean;
  notifications: boolean;
};

// Requests the runtime permissions the SMS pipeline needs. Safe to call repeatedly:
// already-granted permissions resolve immediately without a dialog.
export async function requestAppPermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return { sms: false, notifications: false };

  // Only RECEIVE_SMS: new SMS arrive via SmsReceiver. READ_SMS is asked only by "Импорт SMS" (ui/smsImportFlow).
  const wanted = [PermissionsAndroid.PERMISSIONS.RECEIVE_SMS];
  // POST_NOTIFICATIONS is a runtime permission only on Android 13 (API 33)+
  if (Platform.Version >= 33) wanted.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);

  const result = await PermissionsAndroid.requestMultiple(wanted);
  const granted = (p: string) => result[p as keyof typeof result] === PermissionsAndroid.RESULTS.GRANTED;

  return {
    sms: granted(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
    notifications: Platform.Version < 33 || granted(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS),
  };
}

export default { requestAppPermissions };
