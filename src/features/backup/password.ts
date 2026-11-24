// "Пароль для копий": asked when the automatic copy's place is picked (optional for a folder, a must for Google Drive);
// copies (by hand and automatic) encrypted with it when it is set; an encrypted copy asks for it when restored. The
// password itself is kept by the native side (BackupCrypto), apart from the database.
import { exportDatabase } from '@/backup';
import { decryptFile, deleteFile, encryptFile, filePath, hasPassword, isEncrypted, setPassword } from '@/native/backup';
import { toast, toastError } from '@/shared/ui/toast';
import { backupSettingsChanged } from './model/changes';
import { PASSWORD_SET, WRONG_PASSWORD } from './texts';
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

/**
 * A new password ("Задать пароль", "Сменить пароль"): asked twice. `optional` — «Пропустить» instead of «Отмена» (a
 * folder picked for the automatic copy: the password is asked right after it, may be skipped).
 */
export async function choosePassword(optional = false) {
  const password = await askPassword(optional ? 'set-optional' : (await hasPassword()) ? 'change' : 'set');
  if (password === null) return;
  await setPassword(password);
  backupSettingsChanged();
  toast(PASSWORD_SET);
}
