// "Резервная копия" (Настройки): save a copy of the database, restore from one, the operations as a CSV table.
// The sheet with these and the switches: ui/BackupSheet.tsx.
import { checkBackup, csvOperations, operationsCsv } from '@/backup';
import { closeDb } from '@/db';
import { deleteFile, hasPassword, pickFile, replaceDatabase, saveFile, saveText } from '@/native/backup';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast } from '@/shared/ui/toast';
import { CANCEL } from '@/shared/lib/strings';
import { choosePassword, makeCopy, openCopy } from './password';
import { dateKey as today, run } from './run';
import { pickCloudCopy } from './cloud';
import { CSV_SAVED, FAILED, FROM_CLOUD, FROM_FILE, NOT_SUITABLE, PROBLEMS, RESTORE, RESTORE_FROM, RESTORE_INFO, RESTORE_QUESTION, SAVED } from './texts';

/** The copy written before "save as" offers it, and the picked file being checked: both in the app's files dir. */
const COPY = 'backup-copy.db';
const PICKED = 'restore-check.db';
/** The picked copy decrypted (when it was encrypted). */
const PLAIN = 'restore-plain.db';

/**
 * «Экспорт копии»: no password yet — offered first, as for the automatic copy («Пропустить» — without one); then the
 * system save dialog for budget-<date>.db (encrypted with the password, when set).
 */
export async function exportCopy() {
  if (!(await hasPassword())) await choosePassword(true);
  await saveBackup();
}

/** The system save dialog for budget-<date>.db (encrypted with the password, when set). */
async function saveBackup() {
  if (await saveFile(await makeCopy(COPY), `budget-${today()}.db`, 'application/octet-stream')) toast(SAVED);
}

/** "Восстановить из копии": from a file or from Google Drive (asked), then as `restoreFrom`. */
export function restoreBackup(): Promise<void> {
  return new Promise((resolve) => {
    sheetAlert(RESTORE_FROM, undefined, [
      { text: FROM_FILE, onPress: () => { restoreFrom(() => pickFile(PICKED)).then(resolve, resolve); } },
      { text: FROM_CLOUD, onPress: () => { restoreFrom(() => pickCloudCopy(PICKED)).then(resolve, resolve); } },
      { text: CANCEL, style: 'cancel', onPress: () => resolve() },
    ]);
  });
}

/** The copy got (picked file, or downloaded from Drive) — decrypted and checked, replaces the database after a question. */
async function restoreFrom(get: () => Promise<boolean>) {
  try {
    await restoreGot(get);
  } catch (e) {
    console.error('restore failed', e);
    sheetAlert(FAILED, String((e as Error)?.message ?? e));
  }
}

async function restoreGot(get: () => Promise<boolean>) {
  if (!(await get())) return;
  // an encrypted copy: decrypted with its password first
  const file = await openCopy(PICKED, PLAIN);
  if (file === null) {
    await deleteFile(PICKED);
    return;
  }
  const problem = await checkBackup(file);
  if (problem) {
    await deleteFile(file);
    sheetAlert(NOT_SUITABLE, PROBLEMS[problem]);
    return;
  }
  sheetAlert(RESTORE_QUESTION, RESTORE_INFO, [
    { text: RESTORE, style: 'destructive', onPress: run('restore', async () => { await closeDb(); await replaceDatabase(file); }) },
    { text: CANCEL, style: 'cancel', onPress: () => { deleteFile(file).catch(() => undefined); } },
  ]);
}

/** "Экспорт CSV": every operation as a table. */
export async function exportCsv() {
  if (await saveText(operationsCsv(await csvOperations()), `operations-${today()}.csv`, 'text/csv')) toast(CSV_SAVED);
}
