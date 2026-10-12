// "Блокировка": when the PIN is asked on coming back (features/app-lock/model/lockTiming.ts).
import { shouldLock } from '../../src/features/app-lock/model/lockTiming';

const T = 1_000_000;

test('asked after "Спрашивать после сворачивания" in the background, not sooner', () => {
  expect(shouldLock(true, 60, T, T + 59_999)).toBe(false);
  expect(shouldLock(true, 60, T, T + 60_000)).toBe(true);
});

test('"Сразу": asked at once', () => {
  expect(shouldLock(true, 0, T, T)).toBe(true);
});

test('not asked without a PIN or without having left (a system window over the app)', () => {
  expect(shouldLock(false, 0, T, T + 999_999)).toBe(false);
  expect(shouldLock(true, 0, null, T)).toBe(false);
});
