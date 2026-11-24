// "Автокопия" (Настройки → Резервная копия): once a week, when the app is opened, a copy into the folder the user
// picked (the two newest kept) or to Google Drive («На Google Диске», cloud.ts); src/backup/auto.ts.
import {
  AUTO_BACKUP_KEEP, AUTO_BACKUP_PREFIX, autoBackup, autoBackupDue, markAutoBackupMade, setAutoBackupFolder,
} from '@/backup';
import { folderName, hasPassword, pickFolder, releaseFolder, saveToFolder } from '@/native/backup';
import { formatDay } from '@/shared/lib/format';
import { toast, toastError } from '@/shared/ui/toast';
import { choosePassword, makeCopy } from './password';
import { dateKey, timeKey } from './run';
import { backupSettingsChanged } from './model/changes';
import { writeCloudCopy } from './cloud';
import { AUTO_FAILED, AUTO_FIRST, AUTO_GONE, AUTO_OFF, AUTO_OFF_HINT, AUTO_ON, CLOUD_FAILED, autoStatus, cloudStatus } from './texts';

/** The copy written before it goes to the folder, in the app's files dir. */
const AUTO_COPY = 'auto-copy.db';
const now = () => Math.floor(Date.now() / 1000);

let running = false;

/** On opening the app (and coming back to it): a copy if one is due. A failure is said once per opening. */
export async function runAutoBackupIfDue(at = now()): Promise<void> {
  if (running) return;
  running = true;
  let cloud = false;
  try {
    const auto = await autoBackup();
    if (!auto || !autoBackupDue(auto.last, at)) return;
    cloud = !!auto.cloud;
    if (auto.cloud) await writeCloudCopy(at);
    else await writeCopy(auto.folder!, at);
    backupSettingsChanged();
  } catch (e) {
    console.warn('auto backup failed', e);
    toastError(cloud ? CLOUD_FAILED : AUTO_FAILED);
  } finally {
    running = false;
  }
}

/** A new file in the folder first, then the older ones beyond AUTO_BACKUP_KEEP go: a whole copy is always there. */
async function writeCopy(folder: string, at: number) {
  await saveToFolder(folder, await makeCopy(AUTO_COPY), `${AUTO_BACKUP_PREFIX}${dateKey(at)}-${timeKey(at)}.db`, AUTO_BACKUP_PREFIX, AUTO_BACKUP_KEEP);
  await markAutoBackupMade(at);
}

/** The switch's line under "Автокопия": where and when, or what it does when off. */
export async function autoBackupStatus(): Promise<{ on: boolean; cloud: string | null; text: string }> {
  const auto = await autoBackup();
  if (!auto) return { on: false, cloud: null, text: AUTO_OFF_HINT };
  const name = auto.cloud ? null : await folderName(auto.folder!);
  if (!auto.cloud && name === null) return { on: true, cloud: null, text: AUTO_GONE };
  const where = auto.cloud ? cloudStatus(auto.cloud) : autoStatus(name!);
  const last = auto.last === null ? null : formatDay(auto.last).replace(/^(Сегодня|Вчера)$/, (w) => w.toLowerCase());
  return { on: true, cloud: auto.cloud, text: last === null ? `${where} ${AUTO_FIRST}` : `${where} Последняя — ${last}.` };
}

/**
 * A folder picked ("Выбрать папку", "Сменить папку"): the copies go there from now on, the first one right away. Turned
 * on to it (not a change of folder) without a password: the password asked first, «Пропустить» — without one.
 */
export async function pickAutoBackupFolder() {
  const folder = await pickFolder();
  if (!folder) return;
  const before = await autoBackup();
  if (!before?.folder && !(await hasPassword())) await choosePassword(true);
  if (before?.folder && before.folder !== folder) await releaseFolder(before.folder);
  await setAutoBackupFolder(folder);
  backupSettingsChanged();
  await writeCopy(folder, now());
  backupSettingsChanged();
  toast(AUTO_ON);
}

/** The switch turned off: no more copies, the folder's permission given back (the copies made stay there). */
export async function turnAutoBackupOff() {
  const auto = await autoBackup();
  if (auto?.folder) await releaseFolder(auto.folder);
  await setAutoBackupFolder(null);
  backupSettingsChanged();
  toast(AUTO_OFF);
}
