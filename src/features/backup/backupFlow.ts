// "Резервная копия" (Настройки): save a copy of the database, restore from one, the operations as a CSV table.
import { autoBackup, checkBackup, csvOperations, exportDatabase, operationsCsv } from '@/backup';
import { closeDb } from '@/db';
import { deleteFile, filePath, pickFile, replaceDatabase, saveFile, saveText } from '@/native/backup';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast } from '@/shared/ui/toast';
import { CANCEL } from '@/shared/lib/strings';
import { openAutoBackup } from './autoBackup';
import { dateKey as today, run } from './run';
import {
  AUTO_LABEL_OFF, AUTO_LABEL_ON, BACKUP, BACKUP_INFO, CSV_SAVED, EXPORT_CSV, NOT_SUITABLE, PROBLEMS, RESTORE, RESTORE_BACKUP,
  RESTORE_INFO, RESTORE_QUESTION, SAVE_BACKUP, SAVED,
} from './texts';

/** The copy written before "save as" offers it, and the picked file being checked: both in the app's files dir. */
const COPY = 'backup-copy.db';
const PICKED = 'restore-check.db';

/** The sheet of "Резервная копия": save, restore, CSV, the automatic copy (on or off). */
export function startBackup() {
  run('backup sheet', async () => {
    const auto = await autoBackup();
    sheetAlert(BACKUP, BACKUP_INFO, [
      { text: SAVE_BACKUP, onPress: run('backup', saveBackup) },
      { text: RESTORE_BACKUP, style: 'secondary', onPress: run('restore', restoreBackup) },
      { text: EXPORT_CSV, style: 'secondary', onPress: run('csv export', exportCsv) },
      { text: auto ? AUTO_LABEL_ON : AUTO_LABEL_OFF, style: 'secondary', onPress: run('auto backup', openAutoBackup) },
      { text: CANCEL, style: 'cancel' },
    ]);
  })();
}

async function saveBackup() {
  // a copy left by an interrupted save: VACUUM INTO needs the name free
  await deleteFile(COPY);
  await exportDatabase(filePath(COPY));
  if (await saveFile(COPY, `budget-${today()}.db`, 'application/octet-stream')) toast(SAVED);
}

async function restoreBackup() {
  if (!(await pickFile(PICKED))) return;
  const problem = await checkBackup(PICKED);
  if (problem) {
    await deleteFile(PICKED);
    sheetAlert(NOT_SUITABLE, PROBLEMS[problem]);
    return;
  }
  sheetAlert(RESTORE_QUESTION, RESTORE_INFO, [
    { text: RESTORE, style: 'destructive', onPress: run('restore', async () => { await closeDb(); await replaceDatabase(PICKED); }) },
    { text: CANCEL, style: 'cancel', onPress: () => { deleteFile(PICKED).catch(() => undefined); } },
  ]);
}

async function exportCsv() {
  if (await saveText(operationsCsv(await csvOperations()), `operations-${today()}.csv`, 'text/csv')) toast(CSV_SAVED);
}
