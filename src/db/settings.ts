import { getDb } from './index';
import type { Db } from './types';

/** Small key/value app settings (e.g. a dismissed hint). `db`: a transaction's handle inside one. */
export async function getSetting(key: string, db?: Db): Promise<string | null> {
  db ??= await getDb();
  return (await db.get<{ value: string | null }>('SELECT value FROM app_settings WHERE key = ?', [key]))?.value ?? null;
}

export async function setSetting(key: string, value: string | null, db?: Db) {
  db ??= await getDb();
  await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

/**
 * The app's currency (Настройки → Валюта, 'display_currency'): what amounts are shown in and what a new plan item or
 * payment starts in; GEL until picked.
 */
export async function systemCurrency(db?: Db): Promise<'GEL' | 'USD' | 'EUR'> {
  const v = await getSetting('display_currency', db);
  return v === 'USD' || v === 'EUR' ? v : 'GEL';
}

export default { getSetting, setSetting };
