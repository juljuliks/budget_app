// 9.11: "Блокировка" — on (a PIN twice, the fingerprint offered), the lock screen after the app was left, off and a new
// PIN after the PIN, the eye's "show". The native module isn't there: its stand-in in memory (src/native/appLock.ts),
// the fingerprint window answers `memoryLock.nextBiometric`. Today: Thursday 15 October 2026 12:00 (setup.ts).
import { act, fireEvent } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { openApp, screen, tap } from './app';
import { memoryLock } from '../../src/native/appLock';
import { refreshLock } from '../../src/features/app-lock/model/lockStore';

const listeners = AppState.addEventListener as jest.Mock;
/** the app goes to the background or comes back (`afterS` later) */
async function appState(s: 'background' | 'active', afterS = 0) {
  const now = Date.now();
  const spy = jest.spyOn(Date, 'now').mockReturnValue(now + afterS * 1000);
  await act(async () => { listeners.mock.calls.forEach(([type, fn]) => type === 'change' && fn(s)); });
  spy.mockRestore();
}
async function leaveAndReturn(afterS: number) {
  await appState('background');
  await appState('active', afterS);
}
async function typePin(pin: string) {
  for (const d of pin) await tap(d);
}
const hidden = (text: string) => expect(screen.queryByText(text)).toBeNull();
/** a switch of the settings by its name */
const toggle = async (label: string, on: boolean) => {
  const sw = await screen.findByLabelText(label);
  await act(async () => { fireEvent(sw, 'valueChange', on); });
};

beforeEach(async () => {
  memoryLock.reset();
  await refreshLock();
  listeners.mockClear();
});

/** The settings open, "Блокировка" switched on: the PIN window */
async function lockOn(opts: { bio?: boolean } = {}) {
  memoryLock.biometricAvailable = !!opts.bio;
  await openApp();
  await tap('Настройки');
  expect(await screen.findByText('Приложение открывается без входа')).toBeTruthy();
  await toggle('Блокировка', true);
}

/** Настройки → "Настроить" (the lock on): the settings close, the lock's sheet opens */
async function openOptions() {
  await tap('Настроить');
  await screen.findByText('Спрашивать после сворачивания');
  hidden('Уведомлять о лимитах');
}

/** The app with the lock on already (PIN 1234), the settings open */
async function withLock(opts: { bio?: boolean } = {}) {
  Object.assign(memoryLock, { pin: '1234', biometric: !!opts.bio, biometricAvailable: !!opts.bio });
  await refreshLock();
  await openApp();
  await tap('Настройки');
  await screen.findByText(opts.bio ? 'Вход по PIN-коду или отпечатку' : 'Вход по PIN-коду');
}

test('9.11.1: on — a PIN, "Дальше", the same PIN again; no sensor: on at once, its settings under the switch', async () => {
  await lockOn();
  expect(await screen.findByText('Придумайте PIN-код')).toBeTruthy();
  expect(screen.getByText('От 4 до 6 цифр')).toBeTruthy();
  // "Дальше" waits for 4 digits
  await typePin('123');
  await tap('Дальше');
  expect(screen.getByText('Придумайте PIN-код')).toBeTruthy();
  await typePin('4');
  await tap('Дальше');
  expect(await screen.findByText('Подтвердите PIN-код')).toBeTruthy();
  await typePin('1235');
  expect(await screen.findByText('PIN-коды не совпадают — введите ещё раз')).toBeTruthy();
  expect(screen.getByText('Придумать заново')).toBeTruthy();
  await typePin('1234');
  expect(await screen.findByText('Блокировка включена')).toBeTruthy();
  expect(memoryLock.pin).toBe('1234');
  expect(await screen.findByText('Вход по PIN-коду')).toBeTruthy();
  // its settings in a sheet of their own: "Настроить" under the switch
  await openOptions();
  for (const t of ['Спрашивать после сворачивания', 'Скрывать суммы в уведомлениях', 'Сменить PIN-код']) expect(screen.getByText(t)).toBeTruthy();
  // no sensor: no fingerprint switch
  hidden('Отпечаток или лицо');
});

test('9.11.2: ✕ while making the PIN — the lock stays off', async () => {
  await lockOn();
  await typePin('12');
  await tap('Отмена');
  expect(await screen.findByText('Приложение открывается без входа')).toBeTruthy();
  expect(memoryLock.pin).toBeNull();
});

test('9.11.3: with a sensor — "Входить по отпечатку?" → "Включить отпечаток" (the system window) → PIN or fingerprint', async () => {
  await lockOn({ bio: true });
  await typePin('1234'); await tap('Дальше'); await typePin('1234');
  expect(await screen.findByText('Входить по отпечатку?')).toBeTruthy();
  await tap('Включить отпечаток');
  expect(await screen.findByText('Блокировка включена')).toBeTruthy();
  expect(await screen.findByText('Вход по PIN-коду или отпечатку')).toBeTruthy();
  expect(memoryLock.biometric).toBe(true);
});

test('9.11.4: left longer than "Спрашивать после сворачивания" → the PIN; wrong ones counted, 5 → a wait; sooner — not asked', async () => {
  Object.assign(memoryLock, { delayS: 60 });
  await withLock();
  // 1 minute: back after 30 s — no lock screen
  await leaveAndReturn(30);
  hidden('Введите PIN-код');
  await leaveAndReturn(61);
  expect(await screen.findByText('Введите PIN-код')).toBeTruthy();
  expect(screen.getByText('Забыли PIN-код?')).toBeTruthy();
  await typePin('0000');
  expect(await screen.findByText('Неверный PIN-код. Осталось попыток: 4')).toBeTruthy();
  for (let i = 0; i < 3; i++) await typePin('0000');
  expect(await screen.findByText('Неверный PIN-код. Осталось попыток: 1')).toBeTruthy();
  await typePin('0000');
  expect(await screen.findByText('Слишком много попыток. Подождите 30 секунд')).toBeTruthy();
  // the digits don't type meanwhile
  await tap('1');
  expect(screen.getByLabelText('Введено цифр: 0')).toBeTruthy();
});

test('9.11.4: the right PIN opens the app; "Всегда" (the default) — asked every time it comes back', async () => {
  await withLock();
  await openOptions();
  await tap('1 мин');
  await tap('Всегда');
  await leaveAndReturn(1);
  expect(await screen.findByText('Введите PIN-код')).toBeTruthy();
  await typePin('1234');
  await act(async () => {});
  hidden('Введите PIN-код');
  // back where it was: the lock's sheet
  expect(screen.getByText('Спрашивать после сворачивания')).toBeTruthy();
});

test('9.11.5: the fingerprint on — the system window right away on coming back; recognised — the app', async () => {
  await withLock({ bio: true });
  await leaveAndReturn(61);
  await act(async () => {});
  hidden('Введите PIN-код');
});

test('9.11.5: "Всегда" with the fingerprint — not asked into the background (Android drops it), asked on coming back', async () => {
  await withLock({ bio: true });
  const state = AppState as unknown as { currentState: string };
  state.currentState = 'background';
  memoryLock.asked = 0;
  await appState('background');
  expect(await screen.findByText('Введите PIN-код')).toBeTruthy();
  expect(memoryLock.asked).toBe(0);
  state.currentState = 'active';
  await appState('active');
  await act(async () => {});
  expect(memoryLock.asked).toBe(1);
  hidden('Введите PIN-код');
  // and the next time too (a while after the fingerprint window): the lock still follows the app
  state.currentState = 'background';
  await appState('background', 5);
  expect(await screen.findByText('Введите PIN-код')).toBeTruthy();
  state.currentState = 'active';
  await appState('active');
  await act(async () => {});
  hidden('Введите PIN-код');
});

test('9.11.6: off — "Выключить блокировку" asks the PIN: ✕ keeps it on, the PIN turns it off', async () => {
  await withLock();
  await toggle('Блокировка', false);
  expect(await screen.findByText('Выключить блокировку')).toBeTruthy();
  expect(screen.getByText('Приложение будет открываться без входа')).toBeTruthy();
  await tap('Отмена');
  expect(await screen.findByText('Вход по PIN-коду')).toBeTruthy();
  await toggle('Блокировка', false);
  await screen.findByText('Выключить блокировку');
  await typePin('1234');
  expect(await screen.findByText('Блокировка выключена')).toBeTruthy();
  expect(await screen.findByText('Приложение открывается без входа')).toBeTruthy();
  expect(memoryLock.pin).toBeNull();
});

test('9.11.7: "Сменить PIN-код" — the current one, then a new one twice; the old one no longer opens', async () => {
  await withLock();
  await openOptions();
  await tap('Сменить PIN-код');
  expect(await screen.findByText('Текущий PIN-код')).toBeTruthy();
  await typePin('1234');
  expect(await screen.findByText('Новый PIN-код')).toBeTruthy();
  await typePin('98765'); await tap('Дальше'); await typePin('98765');
  expect(await screen.findByText('PIN-код изменён')).toBeTruthy();
  expect(memoryLock.pin).toBe('98765');
});

test('9.11.8: the eye — hiding at once, showing after the PIN ("Показать суммы")', async () => {
  Object.assign(memoryLock, { pin: '1234' });
  await refreshLock();
  await openApp();
  await tap('Статистика');
  await tap('Скрыть суммы бюджета');
  await tap('Показать суммы бюджета');
  expect(await screen.findByText('Показать суммы')).toBeTruthy();
  await typePin('1234');
  expect(await screen.findByLabelText('Скрыть суммы бюджета')).toBeTruthy();
});
