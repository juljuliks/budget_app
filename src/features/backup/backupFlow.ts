// "Резервная копия" (Настройки): save a copy of the database, restore from one, the operations as a CSV table.
// The sheet with these and the switches: ui/BackupSheet.tsx.
import { checkBackup, csvOperations, operationsCsv } from '@/backup';
import { closeDb } from '@/db';
import { deleteFile, pickFile, replaceDatabase, saveFile, saveText } from '@/native/backup';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast } from '@/shared/ui/toast';
import { CANCEL } from '@/shared/lib/strings';
import { makeCopy, openCopy } from './password';
import { dateKey as today, run } from './run';
import { CSV_SAVED, NOT_SUITABLE, PROBLEMS, RESTORE, RESTORE_INFO, RESTORE_QUESTION, SAVED } from './texts';

/** The copy written before "save as" offers it, and the picked file being checked: both in the app's files dir. */
const COPY = 'backup-copy.db';
const PICKED = 'restore-check.db';
/** The picked copy decrypted (when it was encrypted). */
const PLAIN = 'restore-plain.db';

/** "Сохранить копию": the system save dialog for budget-<date>.db (encrypted with the password, when set). */
export async function saveBackup() {
  if (await saveFile(await makeCopy(COPY), `budget-${today()}.db`, 'application/octet-stream')) toast(SAVED);
}

/** "Восстановить из копии": a picked copy, decrypted and checked, replaces the database after a question. */
export async function restoreBackup() {
  if (!(await pickFile(PICKED))) return;
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
