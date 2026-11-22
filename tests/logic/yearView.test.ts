// «Итоги года» as the stories show it (features/month-report/model/yearView.ts).
import type { YearMonth, YearReport } from '../../src/db/yearReport';
import { yearBars, yearLines, yearTable } from '../../src/features/month-report/model/yearView';

const nb = (x: unknown) => JSON.parse(JSON.stringify(x).replace(/[  ]/g, ' '));
const m = (ym: string, x: Partial<YearMonth>): YearMonth => ({ ym, state: 'data', income: 0, spent: 0, hasPlan: true, budget: null, saved: null, pct: null, ...x });
const report = (x: Partial<YearReport> = {}): YearReport => ({
  year: 2026, currency: 'GEL', count: 3, over: false, average: null, income: 900000, spent: 500000, saved: 70000, budget: 400000, funds: 0, planMonths: 2,
  pace: 200000, goalPct: 15, best: { ym: '2026-09', saved: 80000, pct: 40 }, worst: { ym: '2026-10', saved: -10000, reason: '💻 Техника вне плана' },
  savings: null, fundsNow: [], top: [], impulse: null, savedIn: null,
  months: [
    ...Array.from({ length: 7 }, (_, i) => m(`2026-0${i + 1}`, { state: 'none', hasPlan: false })),
    m('2026-08', { income: 300000, spent: 100000, hasPlan: false }),
    m('2026-09', { budget: 200000, saved: 80000, pct: 40 }),
    m('2026-10', { budget: 200000, saved: -10000, pct: -5 }),
    m('2026-11', { state: 'future', hasPlan: false }), m('2026-12', { state: 'future', hasPlan: false }),
  ],
  ...x,
});

beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-15T12:00:00'), advanceTimers: true }));
afterEach(() => jest.useRealTimers());

test('the bars: against the tallest, the overspend down, below the goal paler; no data grey; a month over with a plan pressed', () => {
  const { bars, goalAt, reached } = yearBars(report());
  expect(bars.slice(7, 12).map((b) => [b.label, b.height, b.down, b.pale, b.grey, b.pressable])).toEqual([
    ['авг', 0, false, false, false, false], ['сен', 1, false, false, false, true], ['окт', 0.125, true, true, false, true],
    ['ноя', 0, false, false, true, false], ['дек', 0, false, false, true, false]]);
  expect([goalAt, reached]).toEqual([0.375, 1]);
});

test('the table: «—» where there is nothing, ▲▼, the total and the average', () => {
  const t = nb(yearTable(report()));
  expect(t.rows.slice(7, 11).map((r: { name: string; income: string; saved: string; pct: string; mark: string }) => [r.name, r.income, r.saved, r.pct, r.mark])).toEqual([
    ['Август', '3 000', '—', '—', ''], ['Сентябрь', '0', '800', '40', '▲'], ['Октябрь', '0', '−100', '−5', '▼'], ['Ноябрь', '—', '—', '—', '']]);
  expect(t.total).toEqual(['9 000', '5 000', '700', '18']);
  expect(t.average).toEqual(['3 000', '1 667', '233', '']);
});

test('the lines: so far / the whole year, the goal reached, the pace, best and worst', () => {
  expect(nb(yearLines(report()))).toMatchObject({
    savedCaption: 'Отложено за 3 месяца', ofBudget: '18% бюджета · цель 15% ✓', pace: '≈ 2 000 ₾ за год в таком темпе', inPlan: '2 из 3 мес',
    best: { title: 'Сентябрь · 40% бюджета', value: '+800 ₾' }, worst: { title: 'Октябрь · 💻 Техника вне плана', value: '−100 ₾' },
  });
  expect(yearLines(report({ over: true, pace: null, goalPct: 20 }))).toMatchObject({ savedCaption: 'Отложено за 2026', ofBudget: '18% бюджета · цель 20%', pace: null });
});

test('«Отложено» and its pace in the last budget\'s currency; the rest in the system one', () => {
  const l = yearLines(report({ savedIn: { currency: 'USD', rate: 0.4 } }));
  expect(nb([l.saved(70000), l.pace, l.money(500000)])).toEqual(['280 $', '≈ 800 $ за год в таком темпе', '5 000 ₾']);
});

