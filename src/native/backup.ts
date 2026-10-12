import { NativeModules } from 'react-native';
import { whileOutside } from './appLock';

// BackupModule (android/.../backup): the system "save as" / "open" dialogs and putting a backup in place of the database.
type Native = {
  filesDir: string;
  saveFile(name: string, title: string, mime: string): Promise<boolean>;
  saveText(text: string, title: string, mime: string): Promise<boolean>;
  pickFile(name: string): Promise<boolean>;
  deleteFile(name: string): Promise<boolean>;
  replaceDatabase(source: string, db: string): Promise<boolean>;
  pickFolder(): Promise<string | null>;
  folderName(folder: string): Promise<string | null>;
  releaseFolder(folder: string): Promise<boolean>;
  saveToFolder(folder: string, name: string, title: string, prefix: string, keep: number): Promise<boolean>;
  hasPassword(): Promise<boolean>;
  setPassword(password: string | null): Promise<boolean>;
  isEncrypted(name: string): Promise<boolean>;
  encryptFile(source: string, target: string): Promise<boolean>;
  decryptFile(source: string, target: string, password: string): Promise<boolean>;
};

const native = NativeModules.Backup as Native | undefined;

const need = (): Native => {
  if (!native) throw new Error('Backup is only on Android');
  return native;
};

/** quick-sqlite's database file (src/db/driver.native.ts) */
export const DB_FILE = 'app.db';

/** A file of the app's files dir by its full path (VACUUM INTO writes there). */
export const filePath = (name: string) => `${need().filesDir}/${name}`;

/** "Save as": the file `name` of the files dir, offered as `title`; false if cancelled. The file is deleted. */
export const saveFile = (name: string, title: string, mime: string) => whileOutside(() => need().saveFile(name, title, mime));

/** "Save as" for a text; false if cancelled. */
export const saveText = (text: string, title: string, mime: string) => whileOutside(() => need().saveText(text, title, mime));

/** "Open": the picked file is copied to `name` in the files dir; false if cancelled. */
export const pickFile = (name: string) => whileOutside(() => need().pickFile(name));

export const deleteFile = (name: string) => need().deleteFile(name);

/** The checked file `source` in place of the database (closed first); the app's JS then restarts. */
export const replaceDatabase = (source: string) => need().replaceDatabase(source, DB_FILE);

/** A folder for the automatic copies (its URI, the permission kept); null if cancelled. */
export const pickFolder = () => whileOutside(() => need().pickFolder());

/** The folder's name ("Download"); null when it is gone or no longer allowed. */
export const folderName = (folder: string) => need().folderName(folder);

export const releaseFolder = (folder: string) => need().releaseFolder(folder);

/** The file `name` of the files dir into the folder as `title`; then only the newest `keep` files named `prefix…` stay. */
export const saveToFolder = (folder: string, name: string, title: string, prefix: string, keep: number) =>
  need().saveToFolder(folder, name, title, prefix, keep);

/** Is the backups' password set (kept by the native side, apart from the database). */
export const hasPassword = () => need().hasPassword();

/** Sets the backups' password, or clears it (null). */
export const setPassword = (password: string | null) => need().setPassword(password);

/** Is the file `name` of the files dir an encrypted copy. */
export const isEncrypted = (name: string) => need().isEncrypted(name);

/** Encrypts `source` into `target` with the password's key; `source` is deleted. */
export const encryptFile = (source: string, target: string) => need().encryptFile(source, target);

/** Decrypts `source` into `target`; false when the password is wrong. */
export const decryptFile = (source: string, target: string, password: string) => need().decryptFile(source, target, password);
