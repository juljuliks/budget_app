// "Резервная копия" (Настройки): save a copy of the database, restore from one, the operations as a CSV table.
import { autoBackup, checkBackup, csvOperations, operationsCsv } from '@/backup';
import { closeDb } from '@/db';
import { deleteFile, hasPassword, pickFile, replaceDatabase, saveFile, saveText } from '@/native/backup';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast } from '@/shared/ui/toast';
import { CANCEL } from '@/shared/lib/strings';
import { openAutoBackup } from './autoBackup';
import { makeCopy, openCopy, openPassword } from './password';
import { dateKey as today, run } from './run';
import {
  AUTO_LABEL_OFF, AUTO_LABEL_ON, PASSWORD_LABEL_OFF, PASSWORD_LABEL_ON, BACKUP, BACKUP_INFO, CSV_SAVED, EXPORT_CSV, NOT_SUITABLE, PROBLEMS, RESTORE, RESTORE_BACKUP,
  RESTORE_INFO, RESTORE_QUESTION, SAVE_BACKUP, SAVED,
} from './texts';

/** The copy written before "save as" offers it, and the picked file being checked: both in the app's files dir. */
const COPY = 'backup-copy.db';
const PICKED = 'restore-check.db';
/** The picked copy decrypted (when it was encrypted). */
const PLAIN = 'restore-plain.db';

/** The sheet of "Резервная копия": save, restore, CSV, the automatic copy (on or off), the password (set or not). */
export function startBackup() {
  run('backup sheet', async () => {
    const [auto, password] = await Promise.all([autoBackup(), hasPassword()]);
    sheetAlert(BACKUP, BACKUP_INFO, [
      { text: SAVE_BACKUP, onPress: run('backup', saveBackup) },
      { text: RESTORE_BACKUP, style: 'secondary', onPress: run('restore', restoreBackup) },
      { text: EXPORT_CSV, style: 'secondary', onPress: run('csv export', exportCsv) },
      { text: auto ? AUTO_LABEL_ON : AUTO_LABEL_OFF, style: 'secondary', onPress: run('auto backup', openAutoBackup) },
      { text: password ? PASSWORD_LABEL_ON : PASSWORD_LABEL_OFF, style: 'secondary', onPress: run('password', openPassword) },
      { text: CANCEL, style: 'cancel' },
    ]);
  })();
}

async function saveBackup() {
  if (await saveFile(await makeCopy(COPY), `budget-${today()}.db`, 'application/octet-stream')) toast(SAVED);
}

async function restoreBackup() {
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

async function exportCsv() {
  if (await saveText(operationsCsv(await csvOperations()), `operations-${today()}.csv`, 'text/csv')) toast(CSV_SAVED);
}
