// The "Блокировка" settings' steps: turning it on (a PIN twice, then the fingerprint offered), off and changing the PIN
// (after the PIN or the fingerprint); each change re-read by the lock (refreshLock).
import { authenticate, lockState, setBiometric, setHideNotifications, setLockDelay, setPin } from '@/native/appLock';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast } from '@/shared/ui/toast';
import { scheduleMonthReports } from '@/notifications/monthReportNotice';
import { askNewPin, verifyUser } from './requests';
import { refreshLock } from './lockStore';
import {
  BIO_SUBTITLE, BIOMETRIC, CHANGE_PIN, CURRENT_PIN, ENTER_PIN, LOCK, LOCK_OFF, LOCK_ON, NEW_PIN, NEW_PIN_CHANGE,
  OFFER_INFO, OFFER_NO, SHOW_AMOUNTS, OFFER_TITLE, OFFER_YES, PIN_CHANGED, TURN_OFF, TURN_OFF_HINT, USE_PIN,
} from '../texts';

/** The fingerprint window to confirm it works; then it is on. */
async function turnBiometricOn(): Promise<boolean> {
  if ((await authenticate(BIOMETRIC, BIO_SUBTITLE, USE_PIN)) !== 'ok') return false;
  await setBiometric(true);
  await refreshLock();
  return true;
}

/** On: a PIN twice; with a sensor — "Входить по отпечатку?". False: cancelled. */
export async function enableLock(): Promise<boolean> {
  const pin = await askNewPin(LOCK, NEW_PIN);
  if (!pin) return false;
  await setPin(pin);
  await refreshLock();
  if ((await lockState()).biometricAvailable) {
    await new Promise<void>((resolve) => sheetAlert(OFFER_TITLE, OFFER_INFO, [
      { text: OFFER_YES, onPress: () => { turnBiometricOn().catch(() => false).finally(resolve); } },
      { text: OFFER_NO, style: 'cancel', onPress: resolve },
    ]));
  }
  toast(LOCK_ON);
  return true;
}

/** Off after the PIN or the fingerprint; the PIN and the lock's settings are forgotten. */
export async function disableLock(): Promise<boolean> {
  if (!(await verifyUser(TURN_OFF, ENTER_PIN, TURN_OFF_HINT))) return false;
  await setPin(null);
  await refreshLock();
  toast(LOCK_OFF);
  return true;
}

export async function changePin() {
  if (!(await verifyUser(CHANGE_PIN, CURRENT_PIN))) return;
  const pin = await askNewPin(CHANGE_PIN, NEW_PIN_CHANGE);
  if (!pin) return;
  await setPin(pin);
  await refreshLock();
  toast(PIN_CHANGED);
}

/** The fingerprint on (after it worked once) or off. */
export async function switchBiometric(on: boolean): Promise<boolean> {
  if (on) return turnBiometricOn();
  await setBiometric(false);
  await refreshLock();
  return true;
}

export async function saveLockDelay(seconds: number) {
  await setLockDelay(seconds);
  await refreshLock();
}

/** The eye's "show the amounts": after the PIN or the fingerprint when the lock is on. */
export const confirmShowAmounts = () => verifyUser(SHOW_AMOUNTS, ENTER_PIN);

/** The month's report is scheduled ahead: re-scheduled with or without its amounts. */
export async function saveHideNotifications(on: boolean) {
  await setHideNotifications(on);
  await scheduleMonthReports();
}
