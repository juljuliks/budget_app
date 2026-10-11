// "Пароль для копий": copies (by hand and automatic) encrypted with it when it is set; an encrypted copy asks for it
// when restored. The password itself is kept by the native side (BackupCrypto), apart from the database.
import { exportDatabase } from '@/backup';
import { decryptFile, deleteFile, encryptFile, filePath, hasPassword, isEncrypted, setPassword } from '@/native/backup';
import { CANCEL } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { run } from './run';
import {
  CHANGE_PASSWORD, PASSWORD, PASSWORD_INFO, PASSWORD_ON_INFO, PASSWORD_REMOVED, PASSWORD_SET, REMOVE_PASSWORD, SET_PASSWORD,
  WRONG_PASSWORD,
} from './texts';
import { askPassword } from './ui/PasswordHost';

/**
 * A copy of the database as the file `name` of the app's files dir, encrypted when the password is set: the name of the
 * file to save (`name` or `name.enc`).
 */
export async function makeCopy(name: string): Promise<string> {
  // a copy left by an interrupted save: VACUUM INTO needs the name free
  await deleteFile(name);
  await exportDatabase(filePath(name));
  if (!(await hasPassword())) return name;
  const encrypted = `${name}.enc`;
  await deleteFile(encrypted);
  await encryptFile(name, encrypted);
  return encrypted;
}

/**
 * The picked copy `name` ready to check: as is, or decrypted into `plain` with the password asked (asked again when
 * wrong). null when the password isn't given.
 */
export async function openCopy(name: string, plain: string): Promise<string | null> {
  if (!(await isEncrypted(name))) return name;
  for (;;) {
    const password = await askPassword('enter');
    if (password === null) return null;
    if (await decryptFile(name, plain, password)) {
      await deleteFile(name);
      return plain;
    }
    toastError(WRONG_PASSWORD);
  }
}

/** The password's sheet: set one, or change / remove it. */
export async function openPassword(): Promise<void> {
  if (!(await hasPassword())) {
    sheetAlert(PASSWORD, PASSWORD_INFO, [{ text: SET_PASSWORD, onPress: run('password set', choose) }, { text: CANCEL, style: 'cancel' }]);
    return;
  }
  sheetAlert(PASSWORD, PASSWORD_ON_INFO, [
    { text: CHANGE_PASSWORD, style: 'secondary', onPress: run('password change', choose) },
    { text: REMOVE_PASSWORD, style: 'destructive', onPress: run('password remove', remove) },
    { text: CANCEL, style: 'cancel' },
  ]);
}

async function choose() {
  const password = await askPassword('set');
  if (password === null) return;
  await setPassword(password);
  toast(PASSWORD_SET);
}

async function remove() {
  await setPassword(null);
  toast(PASSWORD_REMOVED);
}
