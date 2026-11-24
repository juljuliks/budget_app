// 9.9: "Резервная копия" in the settings — saving a copy, restoring from one, the operations as CSV. The system file
// dialogs are the native module's (mocked here); the checks of a file are tests/logic/backup.test.ts.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fireEvent, within } from '@testing-library/react-native';
import { openApp, screen, tap, texts, openSettings } from './app';
import { ops } from '../e2e/seeds';
import { markAutoBackupMade, setAutoBackupCloud, setAutoBackupFolder } from '../../src/backup';
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
  setPassword: jest.fn(async (_password: string | null) => true),
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
// «На Google Диске»: the account and the app's folder on Drive (native/drive.ts)
const mockDrive = {
  signedIn: jest.fn(async (): Promise<string | null> => null),
  signIn: jest.fn(async (): Promise<string | null> => 'julia@example.com'),
  upload: jest.fn(async (_name: string, _title: string, _keep: number) => true),
  list: jest.fn(async () => [
    { id: 'new', name: 'budget-auto-2026-10-14-2130.db.enc', createdTime: '2026-10-14T21:30:00', size: 1000 },
    { id: 'old', name: 'budget-auto-2026-10-07-2130.db.enc', createdTime: '2026-10-07T21:30:00', size: 1000 },
  ]),
  download: jest.fn(async (_id: string, _name: string) => true),
};
jest.mock('../../src/native/drive', () => ({
  signedInAccount: () => mockDrive.signedIn(),
  signInGoogle: () => mockDrive.signIn(),
  signOutGoogle: async () => true,
  uploadCopy: (name: string, title: string, keep: number) => mockDrive.upload(name, title, keep),
  cloudCopies: () => mockDrive.list(),
  downloadCopy: (id: string, name: string) => mockDrive.download(id, name),
}));
const mockCheck = jest.fn<Promise<string | null>, [string]>(async () => null);
jest.mock('../../src/backup/database', () => ({
  ...jest.requireActual('../../src/backup/database'),
  checkBackup: (name: string) => mockCheck(name),
}));

afterAll(() => fs.rmSync(mockDir, { recursive: true, force: true }));


/** The switch of the backup sheet («Автокопия») by its label, turned on or off. */
const flip = async (label: string, on: boolean) => fireEvent(await screen.findByLabelText(label), 'valueChange', on);

const type = (placeholder: string, text: string) => fireEvent.changeText(screen.getByPlaceholderText(placeholder), text);

async function openBackup() {
  await openApp(ops);
  await openSettings('Приложение');
  await tap('Резервная копия');
  await screen.findByText(/Все операции, категории, мерчанты и план — одним файлом/);
}

beforeEach(() => jest.clearAllMocks());

test('9.9.1 the save dialog cancelled: nothing said', async () => {
  mockNative.saveFile.mockResolvedValueOnce(false);
  await openBackup();
  await tap('Экспорт копии');
  await tap('Пропустить');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockNative.saveFile).toHaveBeenCalled();
  expect(texts()).not.toContain('Копия сохранена');
});

test('9.9.2 «Экспорт копии»: the password offered («Пропустить»), then the copy offered as budget-<date>.db', async () => {
  await openBackup();
  await tap('Экспорт копии');
  // no password yet: offered, as for the automatic copy
  await screen.findByPlaceholderText('Повторите пароль');
  await tap('Пропустить');
  expect(await screen.findByText('Копия сохранена')).toBeTruthy();
  expect(mockNative.saveFile).toHaveBeenCalledWith('backup-copy.db', expect.stringMatching(/^budget-\d{4}-\d{2}-\d{2}\.db$/), 'application/octet-stream');
  // the copy was written where the dialog takes it from
  expect(fs.statSync(path.join(mockDir, 'backup-copy.db')).size).toBeGreaterThan(0);
});

test('9.9.3 "Восстановить из копии": asked first, then the file replaces the database', async () => {
  await openBackup();
  await tap('Восстановить из копии');
  await tap('Из файла');
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
  await tap('Из файла');
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
  expect(text.startsWith('﻿Дата;Сумма;Валюта;Тип;Категория;Раздел;Мерчант;Описание\r\n')).toBe(true);
  expect(text.split('\r\n').length).toBeGreaterThan(3);
});

test('9.9.6 «Автокопия» on: «Локально» by default, «Сохранить» — the folder, the password («Пропустить»), the first copy', async () => {
  await openBackup();
  expect(await screen.findByText('Раз в неделю — копия в выбранную папку.')).toBeTruthy();
  // off: no choice shown
  expect(screen.queryByText('Локально')).toBeNull();
  await flip('Автокопия', true);
  expect(radio('Локально')).toBe(true);
  expect(mockNative.pickFolder).not.toHaveBeenCalled();
  await tap('Сохранить');
  // then the password, optional here: «Пропустить»
  expect(await screen.findByPlaceholderText('Повторите пароль')).toBeTruthy();
  await tap('Пропустить');
  expect(await screen.findByText('Автокопия включена')).toBeTruthy();
  expect(mockNative.setPassword).not.toHaveBeenCalled();
  expect(mockNative.saveToFolder).toHaveBeenCalledWith(
    'content://tree/Download', 'auto-copy.db', expect.stringMatching(/^budget-auto-\d{4}-\d{2}-\d{2}-\d{4}\.db$/), 'budget-auto-', 2);
  // the sheet shows it on, with its folder and the date
  expect(await screen.findByText('Раз в неделю в папку «Download», хранятся две последние. Последняя — сегодня.')).toBeTruthy();
  expect(radio('Локально')).toBe(true);
  expect(screen.queryByText('Сохранить')).toBeNull();
  expect(screen.getByText('Сменить папку')).toBeTruthy();
  // off: asked first
  await flip('Автокопия', false);
  expect(await screen.findByText('Выключить автокопию?')).toBeTruthy();
  expect(screen.getByText('Новые копии перестанут сохраняться. Уже сохранённые останутся в папке.')).toBeTruthy();
  await tap('Выключить');
  expect(await screen.findByText('Автокопия выключена')).toBeTruthy();
  expect(await screen.findByText('Раз в неделю — копия в выбранную папку.')).toBeTruthy();
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

test('9.9.8 the password (no row of its own: asked after the folder): at least 8 characters, the same twice', async () => {
  await openBackup();
  expect(screen.queryByLabelText('Пароль для копий')).toBeNull();
  await flip('Автокопия', true);
  await tap('Сохранить');
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
  // set, then the folder's first copy: «Автокопия включена» over «Пароль для копий задан»
  expect(await screen.findByText('Автокопия включена')).toBeTruthy();
  expect(mockNative.setPassword).toHaveBeenCalledWith('синий кит 42');
});

test('9.9.9 with the password set: the copy saved encrypted', async () => {
  mockNative.hasPassword.mockResolvedValue(true);
  await openBackup();
  await tap('Экспорт копии');
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
  await tap('Из файла');
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

test('9.9.11 with the password set: the automatic copy goes to the folder encrypted', async () => {
  mockNative.hasPassword.mockResolvedValue(true);
  await openApp(ops);
  await setAutoBackupFolder('content://tree/Documents');
  await runAutoBackupIfDue(Math.floor(Date.now() / 1000));
  expect(mockNative.encryptFile).toHaveBeenCalledWith('auto-copy.db', 'auto-copy.db.enc');
  expect(mockNative.saveToFolder).toHaveBeenCalledWith(
    'content://tree/Documents', 'auto-copy.db.enc', expect.stringMatching(/^budget-auto-.*\.db$/), 'budget-auto-', 2);
  mockNative.hasPassword.mockResolvedValue(false);
});

test('9.9.12 «Сохранить», then no folder picked: nothing set, «Сохранить» stays', async () => {
  mockNative.pickFolder.mockResolvedValueOnce(null);
  await openBackup();
  await flip('Автокопия', true);
  await tap('Сохранить');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockNative.setPassword).not.toHaveBeenCalled();
  expect(mockNative.saveToFolder).not.toHaveBeenCalled();
  expect(screen.getByText('Раз в неделю — копия в выбранную папку.')).toBeTruthy();
  expect(screen.getByText('Сохранить')).toBeTruthy();
});

test('9.9.13 "Сменить папку": another folder, the old one given back, a copy there at once', async () => {
  await openApp(ops);
  await setAutoBackupFolder('content://tree/Documents');
  await markAutoBackupMade(Math.floor(Date.now() / 1000));
  await openSettings('Приложение');
  await tap('Резервная копия');
  await tap('Сменить папку');
  expect(await screen.findByText('Автокопия включена')).toBeTruthy();
  expect(mockNative.releaseFolder).toHaveBeenCalledWith('content://tree/Documents');
  expect(mockNative.saveToFolder).toHaveBeenCalledWith('content://tree/Download', 'auto-copy.db', expect.any(String), 'budget-auto-', 2);
});

test('9.9.14 "Сменить пароль" (by «Сменить папку», while a password is set) asks a new one twice', async () => {
  mockNative.hasPassword.mockResolvedValue(true);
  await openApp(ops);
  await setAutoBackupFolder('content://tree/Documents');
  await openSettings('Приложение');
  await tap('Резервная копия');
  await tap('Сменить пароль');
  await screen.findByPlaceholderText('Повторите пароль');
  // the copies made keep the old one: said
  expect(screen.getByText(/Уже сохранённые останутся со старым/)).toBeTruthy();
  type('Пароль', 'зелёный кит 7');
  type('Повторите пароль', 'зелёный кит 7');
  await tap('Задать пароль');
  expect(await screen.findByText('Пароль для копий задан')).toBeTruthy();
  expect(mockNative.setPassword).toHaveBeenCalledWith('зелёный кит 7');
  mockNative.hasPassword.mockResolvedValue(false);
});

test('9.9.14a «Локально» without a password: «Задать пароль» — set, the next copies encrypted', async () => {
  passwordKept();
  await openApp(ops);
  await setAutoBackupFolder('content://tree/Documents');
  await openSettings('Приложение');
  await tap('Резервная копия');
  await screen.findByText('Сменить папку');
  expect(screen.queryByText('Сменить пароль')).toBeNull();
  await tap('Задать пароль');
  await screen.findByPlaceholderText('Повторите пароль');
  type('Пароль', 'синий кит 42');
  type('Повторите пароль', 'синий кит 42');
  await tap('Задать пароль');
  expect(await screen.findByText('Пароль для копий задан')).toBeTruthy();
  expect(mockNative.setPassword).toHaveBeenCalledWith('синий кит 42');
  expect(await screen.findByText('Сменить пароль')).toBeTruthy();
});

/** A radio button of the sheet by its label: checked or not. */
const radio = (label: string) => screen.getAllByRole('radio').find((r) => within(r).queryByText(label))!.props.accessibilityState.checked;

/** The password the native side keeps: set by «Задать пароль», as the module would. */
const passwordKept = () => {
  let kept = false;
  mockNative.hasPassword.mockImplementation(async () => kept);
  mockNative.setPassword.mockImplementation(async (password) => { kept = password !== null; return true; });
};
afterEach(() => { mockNative.hasPassword.mockImplementation(async () => false); mockNative.setPassword.mockImplementation(async () => true); });

test('9.9.15 «На Google Диске»: the account, then the password (a must), the first copy encrypted to Drive', async () => {
  passwordKept();
  await openBackup();
  await flip('Автокопия', true);
  expect(await screen.findByText('Вход через Google; пароль обязателен.')).toBeTruthy();
  expect(screen.getByText('В папку на телефоне; пароль — по желанию.')).toBeTruthy();
  await tap('Google Диск');
  await tap('Сохранить');
  // no password yet: asked right away
  await screen.findByPlaceholderText('Повторите пароль');
  type('Пароль', 'синий кит 42');
  type('Повторите пароль', 'синий кит 42');
  await tap('Задать пароль');
  expect(await screen.findByText('Автокопия — на Google Диске')).toBeTruthy();
  expect(mockNative.encryptFile).toHaveBeenCalledWith('cloud-copy.db', 'cloud-copy.db.enc');
  expect(mockDrive.upload).toHaveBeenCalledWith('cloud-copy.db.enc', expect.stringMatching(/^budget-auto-\d{4}-\d{2}-\d{2}-\d{4}\.db\.enc$/), 4);
  expect(await screen.findByText('Аккаунт julia@example.com; пароль обязателен.')).toBeTruthy();
  expect(radio('Google Диск')).toBe(true);
  // the password: only changed
  expect(screen.getByText('Сменить пароль')).toBeTruthy();
  expect(screen.getByText('Сменить аккаунт')).toBeTruthy();
  expect(screen.getByText(/^Раз в неделю на Google Диск \(julia@example\.com\), хранятся четыре последние\./)).toBeTruthy();
});

test('9.9.16 the password not given: Drive stays off, nothing sent', async () => {
  passwordKept();
  await openBackup();
  await flip('Автокопия', true);
  await tap('Google Диск');
  await tap('Сохранить');
  await screen.findByPlaceholderText('Повторите пароль');
  await tap('Отмена');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockDrive.upload).not.toHaveBeenCalled();
  // still off: «Сохранить» stays to try again
  expect(screen.getByText('Раз в неделю — копия в выбранную папку.')).toBeTruthy();
  expect(screen.getByText('Сохранить')).toBeTruthy();
});

test('9.9.18 the weekly copy to Drive on opening the app; a failure said', async () => {
  mockNative.hasPassword.mockImplementation(async () => true);
  await openApp(ops);
  const now = Math.floor(Date.now() / 1000);
  await setAutoBackupCloud('julia@example.com');
  await runAutoBackupIfDue(now);
  expect(mockDrive.upload).toHaveBeenCalledTimes(1);
  expect(mockNative.saveToFolder).not.toHaveBeenCalled();
  mockDrive.upload.mockRejectedValueOnce(new Error('offline'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await runAutoBackupIfDue(now + 8 * 86400);
  expect(await screen.findByText(/Автокопия не ушла на Google Диск/)).toBeTruthy();
});

test('9.9.19 «Восстановить из копии» → «С Google Диска»: a copy picked by its date, downloaded, its password, restored', async () => {
  mockDrive.signedIn.mockResolvedValueOnce('julia@example.com');
  mockNative.isEncrypted.mockResolvedValueOnce(true);
  await openBackup();
  await tap('Восстановить из копии');
  await tap('С Google Диска');
  expect(await screen.findByText('Какую копию восстановить?')).toBeTruthy();
  await tap(/^7 окт/);
  await screen.findByPlaceholderText('Пароль');
  expect(mockDrive.download).toHaveBeenCalledWith('old', 'restore-check.db');
  type('Пароль', 'синий кит 42');
  await tap('Открыть');
  expect(await screen.findByText('Восстановить из копии?')).toBeTruthy();
  await tap('Восстановить');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockNative.replaceDatabase).toHaveBeenCalledWith('restore-plain.db');
});

test('9.9.20 no copies on Drive: said', async () => {
  mockDrive.signedIn.mockResolvedValueOnce('julia@example.com');
  mockDrive.list.mockResolvedValueOnce([]);
  await openBackup();
  await tap('Восстановить из копии');
  await tap('С Google Диска');
  expect(await screen.findByText('На Google Диске копий нет')).toBeTruthy();
  expect(screen.getByText('В аккаунте julia@example.com копий этого приложения нет.')).toBeTruthy();
});

test('9.9.21 from Google Drive to «Локально»: a folder picked, the copies there', async () => {
  passwordKept();
  await openApp(ops);
  await mockNative.setPassword('синий кит 42');
  await setAutoBackupCloud('julia@example.com');
  await openSettings('Приложение');
  await tap('Резервная копия');
  expect(await screen.findByText('Аккаунт julia@example.com; пароль обязателен.')).toBeTruthy();
  // on already: no «Сохранить», the other radio button goes there at once
  expect(screen.queryByText('Сохранить')).toBeNull();
  await tap('Локально');
  expect(await screen.findByText('Автокопия включена')).toBeTruthy();
  expect(mockNative.saveToFolder).toHaveBeenCalled();
  expect(radio('Локально')).toBe(true);
  expect(screen.getByText('Сменить папку')).toBeTruthy();
});

test('9.9.22 «Локально»: the password set right after the folder — the first copy goes encrypted', async () => {
  passwordKept();
  await openBackup();
  await flip('Автокопия', true);
  await tap('Сохранить');
  await screen.findByPlaceholderText('Повторите пароль');
  type('Пароль', 'синий кит 42');
  type('Повторите пароль', 'синий кит 42');
  await tap('Задать пароль');
  expect(await screen.findByText('Автокопия включена')).toBeTruthy();
  expect(mockNative.setPassword).toHaveBeenCalledWith('синий кит 42');
  expect(mockNative.saveToFolder).toHaveBeenCalledWith('content://tree/Download', 'auto-copy.db.enc', expect.any(String), 'budget-auto-', 2);
});

test('9.9.23 «Google Диск»: the password after signing in has no «Пропустить» — only «Отмена»', async () => {
  passwordKept();
  await openBackup();
  await flip('Автокопия', true);
  await tap('Google Диск');
  await tap('Сохранить');
  await screen.findByPlaceholderText('Повторите пароль');
  expect(screen.queryByText('Пропустить')).toBeNull();
  expect(screen.getAllByText('Отмена').length).toBeGreaterThan(0);
});

test('9.9.24 «Экспорт копии» with a password set in its window: the copy saved encrypted', async () => {
  passwordKept();
  await openBackup();
  await tap('Экспорт копии');
  await screen.findByPlaceholderText('Повторите пароль');
  type('Пароль', 'синий кит 42');
  type('Повторите пароль', 'синий кит 42');
  await tap('Задать пароль');
  expect(await screen.findByText('Копия сохранена')).toBeTruthy();
  expect(mockNative.setPassword).toHaveBeenCalledWith('синий кит 42');
  expect(mockNative.saveFile).toHaveBeenCalledWith('backup-copy.db.enc', expect.stringMatching(/^budget-.*\.db$/), 'application/octet-stream');
});

test('9.9.25 turning «Автокопия» off — «Отмена» keeps it on; switched on but nothing saved — off again at once', async () => {
  await openApp(ops);
  await setAutoBackupFolder('content://tree/Documents');
  await openSettings('Приложение');
  await tap('Резервная копия');
  await flip('Автокопия', false);
  await screen.findByText('Выключить автокопию?');
  await tap('Отмена');
  await new Promise((r) => setTimeout(r, 50));
  expect(mockNative.releaseFolder).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Автокопия').props.value).toBe(true);
});

test('9.9.26 switched on, not saved: off again without a question', async () => {
  await openBackup();
  await flip('Автокопия', true);
  expect(screen.getByText('Сохранить')).toBeTruthy();
  await flip('Автокопия', false);
  expect(screen.queryByText('Выключить автокопию?')).toBeNull();
  expect(screen.queryByText('Сохранить')).toBeNull();
  expect(screen.getByLabelText('Автокопия').props.value).toBe(false);
});
