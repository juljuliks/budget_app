
describe('stats periods', () => {
  const { periodRange, shiftAnchor, periodLabel } = require('../src/ui/dateRange');
  test('day, week (Monday to Sunday), year around a date', () => {
    const sun = new Date(2026, 9, 4); // Sunday
    expect(periodRange('day', sun)).toEqual({ from: '2026-10-04', to: '2026-10-04' });
    expect(periodRange('week', sun)).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(periodRange('week', new Date(2026, 8, 28))).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(periodRange('year', sun)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
  test('arrows move by a day, a week or a year; labels', () => {
    const d = new Date(2026, 9, 4);
    expect(periodRange('week', shiftAnchor('week', d, -1))).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(periodRange('day', shiftAnchor('day', d, 1)).from).toBe('2026-10-05');
    expect(periodRange('year', shiftAnchor('year', d, -1)).from).toBe('2025-01-01');
    expect(periodLabel('year', { from: '2026-01-01', to: '2026-12-31' })).toBe('2026');
    expect(periodLabel('custom', { from: '2026-10-01', to: '2026-10-03' })).toBe('1 окт 2026 — 3 окт 2026');
  });
});
