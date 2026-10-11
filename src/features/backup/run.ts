// What the backup's actions share: today's date for the file names, the errors said in a sheet.
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { FAILED } from './texts';

/** "2026-10-11" (local), of `unix` or of now. */
export const dateKey = (unix = Date.now() / 1000) => {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "1332": the time in a file name (the automatic copies of one day stay apart and in order). */
export const timeKey = (unix = Date.now() / 1000) => {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
};

/** A button's action: a failure is logged and said ("Не получилось" and why). */
export const run = (what: string, f: () => Promise<void>) => () => {
  f().catch((e) => {
    console.error(`${what} failed`, e);
    sheetAlert(FAILED, String((e as Error)?.message ?? e));
  });
};
