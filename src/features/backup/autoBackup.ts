// "Автокопия" (Настройки → Резервная копия): once a week, when the app is opened, a copy into the folder the user
// picked; the two newest kept (src/backup/auto.ts).
import {
  AUTO_BACKUP_KEEP, AUTO_BACKUP_PREFIX, autoBackup, autoBackupDue, markAutoBackupMade, setAutoBackupFolder,
} from '@/backup';
import { folderName, pickFolder, releaseFolder, saveToFolder } from '@/native/backup';
import { formatDay } from '@/shared/lib/format';
import { CANCEL } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { makeCopy } from './password';
import { dateKey, run, timeKey } from './run';
import { backupSettingsChanged } from './model/changes';
import { AUTO, AUTO_FAILED, AUTO_FIRST, AUTO_GONE, AUTO_INFO, AUTO_OFF, AUTO_OFF_HINT, AUTO_ON, PICK_FOLDER, autoStatus } from './texts';

/** The copy written before it goes to the folder, in the app's files dir. */
const AUTO_COPY = 'auto-copy.db';
const now = () => Math.floor(Date.now() / 1000);

let running = false;

/** On opening the app (and coming back to it): a copy if one is due. A failure is said once per opening. */
export async function runAutoBackupIfDue(at = now()): Promise<void> {
  if (running) return;
  running = true;
  try {
    const auto = await autoBackup();
    if (!auto || !autoBackupDue(auto.last, at)) return;
    await writeCopy(auto.folder, at);
    backupSettingsChanged();
  } catch (e) {
    console.warn('auto backup failed', e);
    toastError(AUTO_FAILED);
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
export async function autoBackupStatus(): Promise<{ on: boolean; text: string }> {
  const auto = await autoBackup();
  if (!auto) return { on: false, text: AUTO_OFF_HINT };
  const name = await folderName(auto.folder);
  if (name === null) return { on: true, text: AUTO_GONE };
  const last = auto.last === null ? null : formatDay(auto.last).replace(/^(Сегодня|Вчера)$/, (w) => w.toLowerCase());
  return { on: true, text: last === null ? `${autoStatus(name)} ${AUTO_FIRST}` : `${autoStatus(name)} Последняя — ${last}.` };
}

/** The switch turned on: what it does, then the folder (on only once one is picked). */
export function askAutoBackupOn() {
  sheetAlert(AUTO, AUTO_INFO, [{ text: PICK_FOLDER, onPress: run('auto backup on', pickAutoBackupFolder) }, { text: CANCEL, style: 'cancel' }]);
}

/** A folder picked ("Выбрать папку", "Сменить папку"): the copies go there from now on, the first one right away. */
export async function pickAutoBackupFolder() {
  const folder = await pickFolder();
  if (!folder) return;
  const before = await autoBackup();
  if (before && before.folder !== folder) await releaseFolder(before.folder);
  await setAutoBackupFolder(folder);
  backupSettingsChanged();
  await writeCopy(folder, now());
  backupSettingsChanged();
  toast(AUTO_ON);
}

/** The switch turned off: no more copies, the folder's permission given back (the copies made stay there). */
export async function turnAutoBackupOff() {
  const auto = await autoBackup();
  if (auto) await releaseFolder(auto.folder);
  await setAutoBackupFolder(null);
  backupSettingsChanged();
  toast(AUTO_OFF);
}
