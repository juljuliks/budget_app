import { NativeModules } from 'react-native';
import { whileOutside } from './appLock';

// DriveModule (android/.../backup): the Google account and the app's own hidden folder on its Google Drive.
export type CloudCopy = { id: string; name: string; createdTime: string; size: number };
type Native = {
  signedIn(): Promise<string | null>;
  signIn(): Promise<string | null>;
  signOut(): Promise<boolean>;
  upload(name: string, title: string, keep: number): Promise<boolean>;
  listCopies(): Promise<CloudCopy[]>;
  download(id: string, name: string): Promise<boolean>;
};
const native = NativeModules.Drive as Native | undefined;

const need = (): Native => {
  if (!native) throw new Error('Google Drive is only on Android');
  return native;
};

/** The account signed in (with the permission to the app's folder): its email, or null. */
export const signedInAccount = () => (native ? native.signedIn() : Promise.resolve(null));

/** The system's account picker: the email, or null if cancelled. */
export const signInGoogle = () => whileOutside(() => need().signIn());

export const signOutGoogle = () => need().signOut();

/** The file `name` of the app's files dir to the app's folder as `title`; then the newest `keep` stay. The file goes. */
export const uploadCopy = (name: string, title: string, keep: number) => need().upload(name, title, keep);

/** The copies there, newest first. */
export const cloudCopies = () => need().listCopies();

/** The copy `id` into the app's files dir as `name`. */
export const downloadCopy = (id: string, name: string) => need().download(id, name);
