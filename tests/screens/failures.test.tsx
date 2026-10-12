// 9.10: a load that failed — "Не удалось загрузить" and "Повторить" instead of a spinner forever; an operation that's
// gone. Today: Thursday 15 October 2026 (setup.ts).
import { act, fireEvent } from '@testing-library/react-native';
import { openApp, screen, tap } from './app';
import { ops, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { openTransaction } from '../../src/shared/navigation/sheets';

/**
 * The operations unreadable until `fix` (the database "fails"); what the app logs meanwhile is expected. Legacy
 * renaming: the views over them (spend_parts) keep the old name, so they fail too.
 */
async function breakOperations() {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const rename = async (from: string, to: string) => {
    const db = await getDb();
    await db.run('PRAGMA legacy_alter_table = ON');
    await db.run(`ALTER TABLE ${from} RENAME TO ${to}`);
    await db.run('PRAGMA legacy_alter_table = OFF');
  };
  await rename('transactions', 'transactions_off');
  return () => rename('transactions_off', 'transactions');
}

test('9.10.1: the stats failed to load: said, and "Повторить" loads them', async () => {
  await openApp(planned);
  const fix = await breakOperations();
  await tap('Статистика');
  expect(await screen.findByText('Не удалось загрузить')).toBeTruthy();
  expect(console.error).toHaveBeenCalledWith('load stats failed', expect.anything());
  await fix();
  await tap('Повторить');
  expect(await screen.findByText('Потрачено 2 010 / 2 460 ₾ (82%)')).toBeTruthy();
  expect(screen.queryByText('Не удалось загрузить')).toBeNull();
});

test('9.10.2: the history failed to load: the same', async () => {
  await openApp(planned);
  await tap('Статистика');
  await screen.findByText('Потрачено 2 010 / 2 460 ₾ (82%)');
  const fix = await breakOperations();
  await tap('История');
  expect(await screen.findByText('Не удалось загрузить')).toBeTruthy();
  await fix();
  await tap('Повторить');
  expect(await screen.findByText('Сентябрь 2026')).toBeTruthy();
});

test('9.10.3: an operation that is gone (an old notification): "Операция не найдена"', async () => {
  await openApp(ops);
  act(() => openTransaction(999999));
  expect(await screen.findByText('Операция не найдена: возможно, её удалили.')).toBeTruthy();
});

test('9.10.4: a setting that didn\'t save: said in a red toast, the switch back as it was', async () => {
  await openApp(ops);
  await tap('Настройки');
  await screen.findByText('Уведомлять о лимитах');
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await (await getDb()).run('ALTER TABLE app_settings RENAME TO app_settings_off');
  const sw = screen.getByLabelText('Уведомлять о лимитах');
  fireEvent(sw, 'valueChange', false);
  expect(await screen.findByText('⚠️  Не удалось сохранить')).toBeTruthy();
  expect(screen.getByLabelText('Уведомлять о лимитах').props.value).toBe(true);
  await (await getDb()).run('ALTER TABLE app_settings_off RENAME TO app_settings');
});
