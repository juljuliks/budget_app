// The automatic copy: once a week, when the app is opened, into a folder the user picked (the two newest kept) or
// to the app's folder on Google Drive (the four newest; always encrypted).
import { getSetting, setSetting } from '../db/settings';

/** How often a copy is made. */
export const AUTO_BACKUP_DAYS = 7;
/** How many automatic copies the folder keeps: the newest and the one before (a damage noticed late can be undone). */
export const AUTO_BACKUP_KEEP = 2;
/** The automatic copies' names: budget-auto-2026-10-11-1332.db (the manual ones are budget-2026-10-11.db). */
export const AUTO_BACKUP_PREFIX = 'budget-auto-';

/** How many copies the app's folder on Google Drive keeps. */
export const CLOUD_BACKUP_KEEP = 4;

const FOLDER_KEY = 'auto_backup_folder';
/** the Google account the copies go to (its email); set — the copies go to Drive, not the folder */
const CLOUD_KEY = 'auto_backup_cloud';
const LAST_KEY = 'auto_backup_last';

/** Is a copy due: never made, or AUTO_BACKUP_DAYS since the last one (unix seconds). */
export function autoBackupDue(last: number | null, now: number): boolean {
  return last === null || now - last >= AUTO_BACKUP_DAYS * 86400;
}

/** Where the copies go: a folder (its URI) or Google Drive (`cloud`: the account's email) — one of them; null: off. */
export type AutoBackup = { folder: string | null; cloud: string | null; last: number | null } | null;

/** The setting and when the last copy was made. */
export async function autoBackup(): Promise<AutoBackup> {
  const folder = await getSetting(FOLDER_KEY);
  const cloud = await getSetting(CLOUD_KEY);
  if (!folder && !cloud) return null;
  const last = await getSetting(LAST_KEY);
  return { folder: cloud ? null : folder, cloud, last: last ? Number(last) : null };
}

/** On with this folder (the next opening makes a copy; Drive no longer), or off (null). */
export async function setAutoBackupFolder(folder: string | null): Promise<void> {
  await setSetting(FOLDER_KEY, folder);
  await setSetting(CLOUD_KEY, null);
  await setSetting(LAST_KEY, null);
}

/** On to Google Drive of this account (the folder no longer), or off (null). */
export async function setAutoBackupCloud(account: string | null): Promise<void> {
  await setSetting(CLOUD_KEY, account);
  await setSetting(FOLDER_KEY, null);
  await setSetting(LAST_KEY, null);
}

export async function markAutoBackupMade(at: number): Promise<void> {
  await setSetting(LAST_KEY, String(at));
}
