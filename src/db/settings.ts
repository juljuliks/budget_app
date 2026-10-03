import { getDb } from './index';

/** Small key/value app settings (e.g. a dismissed hint). */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  return (await db.get<{ value: string | null }>('SELECT value FROM app_settings WHERE key = ?', [key]))?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  const db = await getDb();
  await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export default { getSetting, setSetting };
