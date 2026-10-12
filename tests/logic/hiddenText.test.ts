// "Скрыть суммы" on the stats' limit lines (screens/stats/model/hiddenText.ts).
import { hiddenLeft, limitMove } from '../../src/screens/stats/model/hiddenText';

test('what is left as a share of the line\'s limit; over it — just the word', () => {
  expect(hiddenLeft(4000, 10000)).toBe('осталось 40%');
  expect(hiddenLeft(0, 10000)).toBe('осталось 0%');
  expect(hiddenLeft(30, 10000)).toBe('осталось <1%');
  expect(hiddenLeft(1200, 10000, 'сэкономлено')).toBe('сэкономлено 12%');
  expect(hiddenLeft(-3500, 10000)).toBe('перерасход');
});

test('a moved limit: by how much, not to what', () => {
  expect(limitMove(11300, 9500)).toBe('↓ 16%');
  expect(limitMove(10000, 10800)).toBe('↑ 8%');
  expect(limitMove(10000, 10020)).toBe('');
});
