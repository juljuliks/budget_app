jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDb } from '../../src/db';
import { openDatabase } from '../../src/db/driver';
import { MIGRATIONS } from '../../src/db/migrations';
import { addManualTransaction, setTransactionNote } from '../../src/db/transactions';
import { checkBackup, csvOperations, exportDatabase, operationsCsv } from '../../src/backup';
import { freshDb } from '../helpers';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-backup-'));
const file = (name: string) => path.join(dir, name);
const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

beforeEach(() => freshDb());
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

test('a backup has every operation and passes the check; opened, it is the same database', async () => {
  await addManualTransaction({ amount_minor: 1250, category_id: 1, description: 'Хлеб', occurred_at: at('2026-10-03T09:30:00') });
  await addManualTransaction({ amount_minor: 99, currency: 'USD', category_id: null, occurred_at: at('2026-10-04T10:00:00') });
  await exportDatabase(file('copy.db'));
  expect(await checkBackup(file('copy.db'))).toBeNull();
  const copy = openDatabase(file('copy.db'));
  expect(await copy.all('SELECT amount_minor, currency FROM transactions ORDER BY id')).toEqual([
    { amount_minor: 1250, currency: 'GEL' }, { amount_minor: 99, currency: 'USD' },
  ]);
  expect((await copy.get<{ user_version: number }>('PRAGMA user_version'))!.user_version).toBe(MIGRATIONS.length);
  copy.close();
});

test('the check refuses a file that is not a database, another app\'s database, one from a newer app', async () => {
  fs.writeFileSync(file('photo.db'), 'definitely not sqlite, just some bytes of a photo '.repeat(100));
  expect(await checkBackup(file('photo.db'))).toBe('not-db');

  const other = openDatabase(file('other.db'));
  await other.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)');
  other.close();
  expect(await checkBackup(file('other.db'))).toBe('not-ours');

  await exportDatabase(file('newer.db'));
  const newer = openDatabase(file('newer.db'));
  await newer.run(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
  newer.close();
  expect(await checkBackup(file('newer.db'))).toBe('newer');
});

test('an older backup passes: it is migrated when opened', async () => {
  await exportDatabase(file('older.db'));
  const older = openDatabase(file('older.db'));
  await older.run(`PRAGMA user_version = ${MIGRATIONS.length - 1}`);
  older.close();
  expect(await checkBackup(file('older.db'))).toBeNull();
});

test('CSV: a header, ";" between cells, a decimal comma, spending negative, quotes where needed, a BOM', async () => {
  const id = await addManualTransaction({ amount_minor: 1250, category_id: 1, description: 'Кафе "Ромашка"; летняя', occurred_at: at('2026-10-03T09:30:00') });
  await setTransactionNote(id, 'с Аней\nи Борей');
  await addManualTransaction({ amount_minor: 10000, kind: 'deposit', category_id: null, occurred_at: at('2026-10-04T10:05:00') });
  const csv = operationsCsv(await csvOperations());
  const category = (await (await getDb()).get<{ name: string }>('SELECT name FROM categories WHERE id = 1'))!.name;
  expect(csv.startsWith('﻿Дата;Сумма;Валюта;Тип;Категория;Раздел;Мерчант;Заметка\r\n')).toBe(true);
  const rows = csv.slice(1).split('\r\n');
  expect(rows[1]).toMatch(new RegExp(`^2026-10-03 09:30;-12,50;GEL;Покупка;${category};[^;]*;"Кафе ""Ромашка""; летняя";"с Аней\\nи Борей"$`));
  expect(rows[2]).toBe('2026-10-04 10:05;100,00;GEL;Пополнение;Без категории;;;');
  expect(rows[3]).toBe('');
});

test('the automatic copy: due when never made or a week after the last; the setting kept, turned off clears it', async () => {
  const { autoBackup, autoBackupDue, markAutoBackupMade, setAutoBackupFolder } = await import('../../src/backup');
  const day = 86400;
  expect(autoBackupDue(null, 1000)).toBe(true);
  expect(autoBackupDue(1000, 1000 + 6 * day)).toBe(false);
  expect(autoBackupDue(1000, 1000 + 7 * day)).toBe(true);
  expect(await autoBackup()).toBeNull();
  await setAutoBackupFolder('content://tree/Download');
  expect(await autoBackup()).toEqual({ folder: 'content://tree/Download', last: null });
  await markAutoBackupMade(5000);
  expect(await autoBackup()).toEqual({ folder: 'content://tree/Download', last: 5000 });
  await setAutoBackupFolder(null);
  expect(await autoBackup()).toBeNull();
});
