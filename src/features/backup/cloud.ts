// «На Google Диске»: the automatic copy to the app's hidden folder on the user's Google Drive (native/drive.ts) —
// signed in with Google, always encrypted with the copies' password (it is asked for first, if not set); restoring
// from one of the copies there.
import { autoBackup, CLOUD_BACKUP_KEEP, AUTO_BACKUP_PREFIX, markAutoBackupMade, setAutoBackupCloud } from '@/backup';
import { cloudCopies, downloadCopy, signedInAccount, signInGoogle, uploadCopy } from '@/native/drive';
import { hasPassword, releaseFolder } from '@/native/backup';
import { formatDay } from '@/shared/lib/format';
import { CANCEL } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast } from '@/shared/ui/toast';
import { choosePassword, makeCopy } from './password';
import { dateKey, run, timeKey } from './run';
import { backupSettingsChanged } from './model/changes';
import { CLOUD, CLOUD_INFO, CLOUD_ON, NO_CLOUD_COPIES, noCloudCopiesInfo, PICK_CLOUD_COPY, SIGN_IN } from './texts';

const CLOUD_COPY = 'cloud-copy.db';
const now = () => Math.floor(Date.now() / 1000);

/** A copy to Drive: encrypted, or none at all. */
export async function writeCloudCopy(at: number) {
  const name = await makeCopy(CLOUD_COPY);
  if (!name.endsWith('.enc')) throw new Error('no password: a copy goes to Google Drive only encrypted');
  await uploadCopy(name, `${AUTO_BACKUP_PREFIX}${dateKey(at)}-${timeKey(at)}.db.enc`, CLOUD_BACKUP_KEEP);
  await markAutoBackupMade(at);
}

/** The switch turned on: what it does, then the account, then the password if none — on only with both. */
export function askCloudOn() {
  sheetAlert(CLOUD, CLOUD_INFO, [{ text: SIGN_IN, onPress: run('cloud backup on', turnCloudOn) }, { text: CANCEL, style: 'cancel' }]);
}

/** The account picked (also «Сменить аккаунт»), the password made sure of, the first copy sent at once. */
export async function turnCloudOn() {
  const account = await signInGoogle();
  if (!account) return;
  if (!(await hasPassword())) await choosePassword();
  if (!(await hasPassword())) return;
  const before = await autoBackup();
  if (before?.folder) await releaseFolder(before.folder);
  await setAutoBackupCloud(account);
  backupSettingsChanged();
  await writeCloudCopy(now());
  backupSettingsChanged();
  toast(CLOUD_ON);
}

/** "24 ноя 2026, 21:30" of a copy's time on Drive. */
const copyLabel = (iso: string) => {
  const d = new Date(iso);
  return `${formatDay(Math.floor(d.getTime() / 1000))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * «С Google Диска»: signed in (the account of the automatic copy, or picked), one of its copies picked and downloaded
 * into `name`; false — cancelled or none there.
 */
export async function pickCloudCopy(name: string): Promise<boolean> {
  const account = (await signedInAccount()) ?? (await signInGoogle());
  if (!account) return false;
  const copies = await cloudCopies();
  if (!copies.length) {
    sheetAlert(NO_CLOUD_COPIES, noCloudCopiesInfo(account));
    return false;
  }
  const picked = await new Promise<string | null>((resolve) => {
    sheetAlert(PICK_CLOUD_COPY, account, [
      ...copies.slice(0, CLOUD_BACKUP_KEEP).map((c) => ({ text: copyLabel(c.createdTime), onPress: () => resolve(c.id) })),
      { text: CANCEL, style: 'cancel' as const, onPress: () => resolve(null) },
    ]);
  });
  if (!picked) return false;
  await downloadCopy(picked, name);
  return true;
}
