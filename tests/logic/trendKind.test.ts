// A category's «Динамика» by how often it is spent on: frequent, rare (rent, a dentist), subscriptions, a fund.
import type { TrendCategory, TrendSpend } from '../../src/db/plans';
import type { Fund, FundMonth } from '../../src/db/plans/funds';
import type { RecurringPayment } from '../../src/db/recurring';
import { rareTrend, trendKind } from '../../src/stats/trendKind';
import { fundTrend, subsTrend } from '../../src/stats/subsFundTrend';

const TODAY = '2026-10-15';
const cat = (over: Partial<TrendCategory> = {}): TrendCategory => ({
  id: 1, name: 'К', emoji: null, type_name: null, color: '#000', compared: true, transfer: false, fund: false, subs: false, ...over,
});
let tx = 0;
const spend = (day: string, lari: number, merchant = 'M'): TrendSpend => ({ category: 1, day, value: lari * 100, merchantKey: merchant, merchant, tx: ++tx });
/** `n` operations in each of the months back (1 = September) */
const monthly = (n: number, back: number[], lari = 10) =>
  back.flatMap((b) => Array.from({ length: n }, (_, i) => spend(`2026-${String(10 - b).padStart(2, '0')}-${String(3 + i).padStart(2, '0')}`, lari)));

test('the kind: a transfer none, a fund, «Подписки», then by the operations a month over 6 full months', () => {
  expect(trendKind(cat({ transfer: true }), [], TODAY)).toBe('none');
  expect(trendKind(cat({ fund: true, subs: true }), [], TODAY)).toBe('fund');
  expect(trendKind(cat({ subs: true }), monthly(5, [1, 2, 3]), TODAY)).toBe('subs');
  expect(trendKind(cat(), monthly(1, [1, 2, 3, 4, 5, 6]), TODAY)).toBe('rare');
  expect(trendKind(cat(), monthly(2, [1, 2, 3]), TODAY)).toBe('rare');
  expect(trendKind(cat(), monthly(4, [1, 2, 3]), TODAY)).toBe('frequent');
  // 2 and 3 a month: the median 2.5 stays frequent
  expect(trendKind(cat(), [...monthly(2, [1, 2]), ...monthly(3, [3, 4])], TODAY)).toBe('frequent');
  // this month's don't count (not full): one month spent in — too few to tell, not guessed from the plan
  expect(trendKind(cat(), monthly(1, [0, 1]), TODAY)).toBe('few');
  expect(trendKind(cat(), [], TODAY)).toBe('few');
});

test('rare, the amount nearly the same: «Подорожал» from the month it went up, the days it is charged', () => {
  const rent = [3, 4, 5].map((d, i) => spend(`2026-0${7 + i}-0${d}`, 1300, 'LANDLORD')).concat(spend('2026-10-04', 1500, 'LANDLORD'));
  const r = rareTrend(rent, TODAY);
  expect(r.stable).toBe(true);
  expect(r.change).toEqual({ from: 130000, to: 150000, ym: '2026-10' });
  expect(r.days).toEqual({ from: 3, to: 5 });
  expect(r.paidMonths).toBe(4);
  expect(r.payments.map((p) => p.value)).toEqual([150000, 130000, 130000, 130000]);
});

test('rare, the amounts apart: no «Подорожал», how often instead', () => {
  const teeth = [spend('2026-01-15', 210), spend('2026-04-03', 820), spend('2026-08-12', 450), spend('2026-10-01', 48)];
  const r = rareTrend(teeth, TODAY);
  expect(r.stable).toBe(false);
  expect(r.change).toBeNull();
  expect(r.days).toBeNull();
  expect(r.every).toBe(3);
  expect(r.total).toBe(152800);
});

test('subscriptions: a month and a year each, a yearly one as a month, one gone, one gone up', () => {
  const sub = (id: number, name: string, period: number, amount: number, until: string | null = null): RecurringPayment => ({
    id, category_id: 1, merchant_key: name, name, amount_minor: amount * 100, currency: 'GEL', period: period as never, due: null, since_ym: '2026-01', until,
  });
  const spends = [
    spend('2026-04-05', 32, 'NETFLIX'), spend('2026-05-05', 45, 'NETFLIX'), spend('2026-10-05', 45, 'NETFLIX'),
    spend('2026-08-01', 160, 'ICLOUD'),
    spend('2026-03-12', 19, 'YOUTUBE'),
  ];
  const s = subsTrend([sub(1, 'NETFLIX', 1, 45), sub(2, 'ICLOUD', 12, 160), sub(3, 'YOUTUBE', 1, 19)], spends, TODAY, 'GEL');
  expect(s.subs.map((x) => [x.name, x.perMonth, x.perYear, x.yearly, x.gone])).toEqual([
    ['NETFLIX', 4500, 54000, false, false],
    ['ICLOUD', 16000 / 12, 16000, true, false],
    ['YOUTUBE', 1900, 22800, false, true],
  ]);
  expect(s.subs[0].change).toEqual({ from: 3200, to: 4500, ym: '2026-05' });
});

test('a subscription in another currency: its own amount, the screen\'s beside it; a rate\'s move isn\'t «подорожал»', () => {
  const icloud: RecurringPayment = {
    id: 1, category_id: 1, merchant_key: 'ICLOUD', name: 'iCloud', amount_minor: 300, currency: 'USD', period: 1 as never, due: null, since_ym: '2026-01', until: null,
  };
  // 3 $ each month; in lari 7.50, then 8.10 (the rate moved 8%)
  const usd = (day: string, lari: number): TrendSpend => ({ ...spend(day, lari, 'ICLOUD'), own: { minor: 300, currency: 'USD' } });
  const [s] = subsTrend([icloud], [usd('2026-08-05', 7.5), usd('2026-09-05', 7.5), usd('2026-10-05', 8.1)], TODAY, 'GEL').subs;
  expect(s.own).toEqual({ amount: 300, currency: 'USD' });
  expect(s.amount).toBe(810);
  expect(s.change).toBeNull();
  // no charge yet: as set, nothing in the screen's currency to say
  const [none] = subsTrend([icloud], [], TODAY, 'GEL').subs;
  expect([none.own, none.amount, none.perMonth]).toEqual([{ amount: 300, currency: 'USD' }, null, null]);
});

test('a fund: put aside against spent by month, the pace to its date, the months without a contribution, the shortage', () => {
  const fund: Fund = { category_id: 1, target_minor: 400000, currency: 'GEL', due: '2027-06-30', start_minor: 0, since_ym: '2026-04', closed_ym: null, released_minor: null };
  const m = (ym: string, contribution: number, spent = 0, shortage = 0): FundMonth => ({ ym, contribution, spent, shortage, start: 0, end: 0 });
  const months = [m('2026-04', 30000), m('2026-05', 30000), m('2026-06', 0), m('2026-07', 30000, 130000, 12000), m('2026-08', 30000), m('2026-09', 30000), m('2026-10', 23000)];
  const f = fundTrend(fund, months, 240000, [spend('2026-07-10', 980, 'AIRWAYS'), spend('2026-07-12', 320, 'BOOKING')], TODAY);
  expect(f.left).toBe(160000);
  expect(f.monthsLeft).toBe(8);
  // the 6 full months before October: 150 000 / 6 = 25 000 a month → 7 months → May 2027, a month before June
  expect(f.pace).toBe(25000);
  expect(f.forecast).toEqual({ ym: '2027-05', offset: -1 });
  expect(f.skipped).toEqual(['2026-06']);
  expect(f.shortage).toEqual({ total: 12000, ym: '2026-07' });
  expect(f.merchants.map((x) => x.name)).toEqual(['AIRWAYS', 'BOOKING']);
  expect(f.bars.find((b) => b.ym === '2026-07')).toEqual({ ym: '2026-07', saved: 30000, spent: 130000, planned: true, current: false });
});
