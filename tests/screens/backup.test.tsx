// 9.9: "Резервная копия" in the settings — saving a copy, restoring from one, the operations as CSV. The system file
// dialogs are the native module's (mocked here); the checks of a file are tests/logic/backup.test.ts.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fireEvent } from '@testing-library/react-native';
import { openApp, screen, tap, texts } from './app';
import { ops } from '../e2e/seeds';
import { markAutoBackupMade, setAutoBackupFolder } from '../../src/backup';
import { runAutoBackupIfDue } from '../../src/features/backup';

const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-backup-ui-'));

const mockNative = {
  saveFile: jest.fn(async () => true),
  saveText: jest.fn(async () => true),
  pickFile: jest.fn(async () => true),
  deleteFile: jest.fn(async (name: string) => { fs.rmSync(path.join(mockDir, name), { force: true }); return true; }),
  replaceDatabase: jest.fn(async () => true),
  pickFolder: jest.fn(async (): Promise<string | null> => 'content://tree/Download'),
  folderName: jest.fn(async (): Promise<string | null> => 'Download'),
  releaseFolder: jest.fn(async () => true),
  saveToFolder: jest.fn(async () => true),
  hasPassword: jest.fn(async () => false),
  setPassword: jest.fn(async () => true),
  isEncrypted: jest.fn(async () => false),
  encryptFile: jest.fn(async () => true),
  decryptFile: jest.fn(async () => true),
};
jest.mock('../../src/native/backup', () => ({
  DB_FILE: 'app.db',
  filePath: (name: string) => require('path').join(mockDir, name),
  saveFile: (...a: unknown[]) => (mockNative.saveFile as (...x: unknown[]) => Promise<boolean>)(...a),
  saveText: (...a: unknown[]) => (mockNative.saveText as (...x: unknown[]) => Promise<boolean>)(...a),
  pickFile: (...a: unknown[]) => (mockNative.pickFile as (...x: unknown[]) => Promise<boolean>)(...a),
  deleteFile: (name: string) => mockNative.deleteFile(name),
  replaceDatabase: (...a: unknown[]) => (mockNative.replaceDatabase as (...x: unknown[]) => Promise<boolean>)(...a),
  pickFolder: () => mockNative.pickFolder(),
  folderName: () => mockNative.folderName(),
  releaseFolder: (...a: unknown[]) => (mockNative.releaseFolder as (...x: unknown[]) => Promise<boolean>)(...a),
  saveToFolder: (...a: unknown[]) => (mockNative.saveToFolder as (...x: unknown[]) => Promise<boolean>)(...a),
  hasPassword: () => mockNative.hasPassword(),
  setPassword: (...a: unknown[]) => (mockNative.setPassword as (...x: unknown[]) => Promise<boolean>)(...a),
  isEncrypted: (...a: unknown[]) => (mockNative.isEncrypted as (...x: unknown[]) => Promise<boolean>)(...a),
  encryptFile: (...a: unknown[]) => (mockNative.encryptFile as (...x: unknown[]) => Promise<boolean>)(...a),
  decryptFile: (...a: unknown[]) => (mockNative.decryptFile as (...x: unknown[]) => Promise<boolean>)(...a),
}));
const mockCheck = jest.fn<Promise<string | null>, [string]>(async () => null);
jest.mock('../../src/backup/database', () => ({
  ...jest.requireActual('../../src/backup/database'),
  checkBackup: (name: string) => mockCheck(name),
}));

afterAll(() => fs.rmSync(mockDir, { recursive: true, force: true }));

async function openBackup() {
  await openApp(ops);
  await tap('Настройки');
  await tap('Резервная копия');
  await screen.findByText(/Все операции, категории, мерчанты и план — одним файлом/);
}

beforeEach(() => jest.clearAllMocks());

test('9.9.1 the save dialog cancelled: nothing said', async () => {
  mockNative.saveFile.mockResolvedValueOnce(false);
  await openBackup();
  await tap('Сохранить копию');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockNative.saveFile).toHaveBeenCalled();
  expect(texts()).not.toContain('Копия сохранена');
});

test('9.9.2 "Сохранить копию": a copy of the database offered as budget-<date>.db, "Копия сохранена"', async () => {
  await openBackup();
  await tap('Сохранить копию');
  expect(await screen.findByText('Копия сохранена')).toBeTruthy();
  expect(mockNative.saveFile).toHaveBeenCalledWith('backup-copy.db', expect.stringMatching(/^budget-\d{4}-\d{2}-\d{2}\.db$/), 'application/octet-stream');
  // the copy was written where the dialog takes it from
  expect(fs.statSync(path.join(mockDir, 'backup-copy.db')).size).toBeGreaterThan(0);
});

test('9.9.3 "Восстановить из копии": asked first, then the file replaces the database', async () => {
  await openBackup();
  await tap('Восстановить из копии');
  expect(await screen.findByText('Восстановить из копии?')).toBeTruthy();
  expect(screen.getByText(/заменятся данными из файла/)).toBeTruthy();
  expect(mockNative.replaceDatabase).not.toHaveBeenCalled();
  await tap('Восстановить');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockCheck).toHaveBeenCalledWith('restore-check.db');
  expect(mockNative.replaceDatabase).toHaveBeenCalledWith('restore-check.db');
});

test('9.9.4 a file that isn\'t a backup of this app: said why, nothing replaced', async () => {
  mockCheck.mockResolvedValueOnce('newer');
  await openBackup();
  await tap('Восстановить из копии');
  expect(await screen.findByText('Этот файл не подходит')).toBeTruthy();
  expect(screen.getByText('Копия сделана более новой версией приложения. Сначала обновите приложение.')).toBeTruthy();
  expect(mockNative.replaceDatabase).not.toHaveBeenCalled();
});

test('9.9.5 "Экспорт CSV": the operations as a table, operations-<date>.csv', async () => {
  await openBackup();
  await tap('Экспорт CSV');
  expect(await screen.findByText('Таблица операций сохранена')).toBeTruthy();
  const [text, title, mime] = mockNative.saveText.mock.calls[0] as unknown as [string, string, string];
  expect(title).toMatch(/^operations-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(mime).toBe('text/csv');
  expect(text.startsWith('﻿Дата;Сумма;Валюта;Тип;Категория;Раздел;Мерчант;Заметка\r\n')).toBe(true);
  expect(text.split('\r\n').length).toBeGreaterThan(3);
});

test('9.9.6 "Автокопия": off at first; a folder picked — the first copy right away, then its folder and date', async () => {
  await openBackup();
  await tap('Автокопия: выключена');
  expect(await screen.findByText(/Раз в неделю, когда вы открываете приложение, копия сохраняется в выбранную папку/)).toBeTruthy();
  await tap('Выбрать папку');
  expect(await screen.findByText('Автокопия включена')).toBeTruthy();
  expect(mockNative.saveToFolder).toHaveBeenCalledWith(
    'content://tree/Download', 'auto-copy.db', expect.stringMatching(/^budget-auto-\d{4}-\d{2}-\d{2}-\d{4}\.db$/), 'budget-auto-', 2);

  await tap('Настройки');
  await tap('Резервная копия');
  await tap('Автокопия: раз в неделю');
  expect(await screen.findByText('Раз в неделю в папку «Download», хранятся две последние. Последняя — сегодня.')).toBeTruthy();
  await tap('Выключить');
  expect(await screen.findByText('Автокопия выключена')).toBeTruthy();
  expect(mockNative.releaseFolder).toHaveBeenCalledWith('content://tree/Download');
});

test('9.9.7 on opening the app: a copy a week after the last one, not sooner; a failure said', async () => {
  await openApp(ops);
  const now = Math.floor(Date.now() / 1000);
  await setAutoBackupFolder('content://tree/Download');
  await markAutoBackupMade(now - 6 * 86400);
  await runAutoBackupIfDue(now);
  expect(mockNative.saveToFolder).not.toHaveBeenCalled();
  await markAutoBackupMade(now - 7 * 86400);
  await runAutoBackupIfDue(now);
  expect(mockNative.saveToFolder).toHaveBeenCalledTimes(1);
  // made: not again the same week
  await runAutoBackupIfDue(now + 3600);
  expect(mockNative.saveToFolder).toHaveBeenCalledTimes(1);

  mockNative.saveToFolder.mockRejectedValueOnce(new Error('no permission'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await runAutoBackupIfDue(now + 8 * 86400);
  expect(mockNative.saveToFolder).toHaveBeenCalledTimes(2);
  expect(await screen.findByText(/Автокопия не сохранилась: выберите папку заново/)).toBeTruthy();
});

const type = (placeholder: string, text: string) => fireEvent.changeText(screen.getByPlaceholderText(placeholder), text);

test('9.9.8 "Пароль для копий": a password and its confirmation, at least 8 characters, the same twice', async () => {
  await openBackup();
  await tap('Пароль для копий: не задан');
  expect(await screen.findByText(/Копии и автокопии будут зашифрованы/)).toBeTruthy();
  await tap('Задать пароль');
  await screen.findByPlaceholderText('Повторите пароль');
  type('Пароль', 'short');
  type('Повторите пароль', 'short');
  await tap('Задать пароль');
  expect(await screen.findByText(/Пароль — не короче 8 символов/)).toBeTruthy();
  type('Пароль', 'синий кит 42');
  type('Повторите пароль', 'синий кот 42');
  await tap('Задать пароль');
  expect(await screen.findByText(/Пароли не совпадают/)).toBeTruthy();
  expect(mockNative.setPassword).not.toHaveBeenCalled();
  type('Повторите пароль', 'синий кит 42');
  await tap('Задать пароль');
  expect(await screen.findByText('Пароль для копий задан')).toBeTruthy();
  expect(mockNative.setPassword).toHaveBeenCalledWith('синий кит 42');
});

test('9.9.9 with the password set: the copy saved encrypted', async () => {
  mockNative.hasPassword.mockResolvedValue(true);
  await openBackup();
  expect(screen.getByText('Пароль для копий: задан')).toBeTruthy();
  await tap('Сохранить копию');
  await screen.findAllByText('Копия сохранена');
  expect(mockNative.encryptFile).toHaveBeenCalledWith('backup-copy.db', 'backup-copy.db.enc');
  expect(mockNative.saveFile).toHaveBeenCalledWith('backup-copy.db.enc', expect.stringMatching(/^budget-.*\.db$/), 'application/octet-stream');
  mockNative.hasPassword.mockResolvedValue(false);
});

test('9.9.10 an encrypted copy restored: its password asked, asked again when wrong', async () => {
  mockNative.isEncrypted.mockResolvedValueOnce(true);
  mockNative.decryptFile.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await openBackup();
  await tap('Восстановить из копии');
  expect(await screen.findByText('Копия зашифрована: введите пароль, заданный при её сохранении.')).toBeTruthy();
  type('Пароль', 'не тот пароль');
  await tap('Открыть');
  expect(await screen.findByText(/Неверный пароль/)).toBeTruthy();
  await screen.findByPlaceholderText('Пароль');
  type('Пароль', 'синий кит 42');
  await tap('Открыть');
  expect(await screen.findByText('Восстановить из копии?')).toBeTruthy();
  expect(mockNative.decryptFile).toHaveBeenLastCalledWith('restore-check.db', 'restore-plain.db', 'синий кит 42');
  await tap('Восстановить');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockCheck).toHaveBeenLastCalledWith('restore-plain.db');
  expect(mockNative.replaceDatabase).toHaveBeenCalledWith('restore-plain.db');
});
