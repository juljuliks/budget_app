// The automatic copy: once a week, when the app is opened, into a folder the user picked; the two newest kept.
import { getSetting, setSetting } from '../db/settings';

/** How often a copy is made. */
export const AUTO_BACKUP_DAYS = 7;
/** How many automatic copies the folder keeps: the newest and the one before (a damage noticed late can be undone). */
export const AUTO_BACKUP_KEEP = 2;
/** The automatic copies' names: budget-auto-2026-10-11-1332.db (the manual ones are budget-2026-10-11.db). */
export const AUTO_BACKUP_PREFIX = 'budget-auto-';

const FOLDER_KEY = 'auto_backup_folder';
const LAST_KEY = 'auto_backup_last';

/** Is a copy due: never made, or AUTO_BACKUP_DAYS since the last one (unix seconds). */
export function autoBackupDue(last: number | null, now: number): boolean {
  return last === null || now - last >= AUTO_BACKUP_DAYS * 86400;
}

export type AutoBackup = { folder: string; last: number | null } | null;

/** The setting: the folder (null: off) and when the last copy was made. */
export async function autoBackup(): Promise<AutoBackup> {
  const folder = await getSetting(FOLDER_KEY);
  if (!folder) return null;
  const last = await getSetting(LAST_KEY);
  return { folder, last: last ? Number(last) : null };
}

/** On with this folder (the next opening makes a copy), or off (null). */
export async function setAutoBackupFolder(folder: string | null): Promise<void> {
  await setSetting(FOLDER_KEY, folder);
  await setSetting(LAST_KEY, null);
}

export async function markAutoBackupMade(at: number): Promise<void> {
  await setSetting(LAST_KEY, String(at));
}
