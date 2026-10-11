// "Автокопия" (Настройки → Резервная копия): once a week, when the app is opened, a copy into the folder the user
// picked; the two newest kept (src/backup/auto.ts).
import {
  AUTO_BACKUP_KEEP, AUTO_BACKUP_PREFIX, autoBackup, autoBackupDue, exportDatabase, markAutoBackupMade, setAutoBackupFolder,
} from '@/backup';
import { deleteFile, filePath, folderName, pickFolder, releaseFolder, saveToFolder } from '@/native/backup';
import { formatDay } from '@/shared/lib/format';
import { CANCEL } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { dateKey, run, timeKey } from './run';
import { AUTO, AUTO_FAILED, AUTO_FIRST, AUTO_GONE, AUTO_INFO, AUTO_OFF, AUTO_ON, CHANGE_FOLDER, PICK_FOLDER, TURN_OFF, autoStatus } from './texts';

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
  } catch (e) {
    console.warn('auto backup failed', e);
    toastError(AUTO_FAILED);
  } finally {
    running = false;
  }
}

/** A new file in the folder first, then the older ones beyond AUTO_BACKUP_KEEP go: a whole copy is always there. */
async function writeCopy(folder: string, at: number) {
  await deleteFile(AUTO_COPY);
  await exportDatabase(filePath(AUTO_COPY));
  await saveToFolder(folder, AUTO_COPY, `${AUTO_BACKUP_PREFIX}${dateKey(at)}-${timeKey(at)}.db`, AUTO_BACKUP_PREFIX, AUTO_BACKUP_KEEP);
  await markAutoBackupMade(at);
}

/** The automatic copy's sheet: what it does and where; turn it on (pick a folder), change the folder, turn it off. */
export async function openAutoBackup(): Promise<void> {
  const auto = await autoBackup();
  if (!auto) {
    sheetAlert(AUTO, AUTO_INFO, [{ text: PICK_FOLDER, onPress: run('auto backup on', turnOn) }, { text: CANCEL, style: 'cancel' }]);
    return;
  }
  const name = await folderName(auto.folder);
  const last = auto.last === null ? null : formatDay(auto.last).replace(/^(Сегодня|Вчера)$/, (w) => w.toLowerCase());
  sheetAlert(AUTO, name === null ? AUTO_GONE : last === null ? `${autoStatus(name)} ${AUTO_FIRST}` : `${autoStatus(name)} Последняя — ${last}.`, [
    { text: CHANGE_FOLDER, style: 'secondary', onPress: run('auto backup folder', turnOn) },
    { text: TURN_OFF, style: 'destructive', onPress: run('auto backup off', turnOff) },
    { text: CANCEL, style: 'cancel' },
  ]);
}

/** A folder picked: the copies go there from now on, the first one right away. */
async function turnOn() {
  const folder = await pickFolder();
  if (!folder) return;
  const before = await autoBackup();
  if (before && before.folder !== folder) await releaseFolder(before.folder);
  await setAutoBackupFolder(folder);
  await writeCopy(folder, now());
  toast(AUTO_ON);
}

async function turnOff() {
  const auto = await autoBackup();
  if (auto) await releaseFolder(auto.folder);
  await setAutoBackupFolder(null);
  toast(AUTO_OFF);
}
