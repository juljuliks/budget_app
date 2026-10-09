// The period stats' formulas and words (screens/stats/period/model/periodText).
import { deltaText, formulaText, noPlanText, summaryText, windowLabelText } from '../../src/screens/stats/period/model/periodText';
import type { NormPart } from '../../src/stats/norms';

const money = (minor: number) => `${(minor / 100).toFixed(2)} ₾`;
const part = (p: Partial<NormPart>): NormPart => ({ ym: '2026-10', days: 7, dim: 31, limit: 50000, spentBefore: 0, daysLeft: 28, norm: 12500, flat: 11290, ...p });

test('what is left or overspent', () => {
  expect(deltaText(3000, 5000, money)).toBe('осталось 20.00 ₾');
  expect(deltaText(11900, 5000, money)).toBe('перерасход 69.00 ₾');
});

test('the limit\'s formula: one month, a month with spending before, two months', () => {
  expect(formulaText([part({})], money)).toBe('500.00 ₾ / 28 × 7 = 125.00 ₾');
  expect(formulaText([part({ spentBefore: 12000, norm: 9500 })], money)).toBe('(500.00 ₾ − 120.00 ₾) / 28 × 7 = 95.00 ₾');
  expect(formulaText([part({ ym: '2026-09', days: 3, daysLeft: 3, limit: 30000, norm: 30000 }), part({ days: 4, daysLeft: 31, norm: 6452 })], money))
    .toBe('300.00 ₾ / 3 × 3 + 500.00 ₾ / 31 × 4 = 300.00 ₾ + 64.52 ₾ = 364.52 ₾');
});

test('a month without a plan counts as 0', () => {
  expect(noPlanText([part({ ym: '2026-09', limit: 0 }), part({})])).toBe(' В сентябре у категории плана нет — эти дни считаются как 0.');
  expect(noPlanText([part({})])).toBe('');
});

test('a week\'s days in this month: none when they are the period itself', () => {
  const week = { from: '2026-09-28', to: '2026-10-04' };
  expect(windowLabelText('2026-10', { from: '2026-10-02', to: '2026-10-02' }, 'week', week)).toBe('Неделя 1 – 4 окт: ');
  expect(windowLabelText('2026-10', { from: '2026-10-01', to: '2026-10-04' }, 'week', week)).toBe('');
});

test('the line under the donut', () => {
  expect(summaryText(true, 0, undefined, money)).toBe('Плана на эти дни нет — показана только структура трат.');
  expect(summaryText(true, 2, undefined, money)).toBeNull();
  expect(summaryText(false, 0, null, money)).toBe('Для среднего в месяц нужен хотя бы один полный месяц с данными.');
  expect(summaryText(false, 0, { average_minor: 150000, months: 2 }, money)).toBe('В среднем 1500.00 ₾ в месяц (2 полных месяца)');
});
