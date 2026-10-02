import { formatMoney, parseAmountInput, toInputValue } from '../src/ui/money';

test.each([
  ['12', 1200], ['12.5', 1250], ['12,50', 1250], ['1 200', 120000], ['0.01', 1],
  ['', null], ['0', null], ['abc', null], ['1.234', null], ['-5', null],
])('parseAmountInput(%j) = %p', (input, expected) => {
  expect(parseAmountInput(input)).toBe(expected);
});

test('formatMoney', () => {
  expect(formatMoney(123456)).toBe('1 234.56');
  expect(formatMoney(120000, { compact: true })).toBe('1 200');
  expect(formatMoney(-250)).toBe('−2.50');
});

test('toInputValue', () => {
  expect(toInputValue(1200)).toBe('12');
  expect(toInputValue(1250)).toBe('12.50');
  expect(toInputValue(null)).toBe('');
});
