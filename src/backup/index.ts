// The data as files: a backup of the database (by hand or automatic) and its restore check, the operations as CSV.
export { checkBackup, exportDatabase } from './database';
export type { BackupProblem } from './database';
export { csvOperations, operationsCsv } from './csv';
export type { CsvOperation } from './csv';
export {
  AUTO_BACKUP_DAYS,
  AUTO_BACKUP_KEEP,
  AUTO_BACKUP_PREFIX,
  autoBackup,
  autoBackupDue,
  CLOUD_BACKUP_KEEP,
  markAutoBackupMade,
  setAutoBackupCloud,
  setAutoBackupFolder,
} from './auto';
export type { AutoBackup } from './auto';
