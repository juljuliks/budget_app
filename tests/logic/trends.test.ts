import type { TrendSpend, TrendsData } from '../../src/db/plans';
import { monthBars, monthsSummary, topMerchants, trendOf, trendWindows, weekBars, weekdayHabits, weekStartOf } from '../../src/stats/trends';
import { pctText, trendLists, whyText } from '../../src/screens/stats/trends/model/trendsView';
import { categoryTrendView } from '../../src/screens/stats/trends/model/categoryTrendView';

// «Динамика трат»: this week / month so far against the usual one by the same days (the median of the past ones).
// "Today" — Friday 30 October 2026.
const TODAY = '2026-10-30';
const spend = (day: string, value: number, merchant: string | null = null, category = 1): TrendSpend =>
  ({ category, day, value, merchantKey: merchant, merchant });

describe('windows', () => {
  test('a week: Monday to today, and the same days of the 8 weeks before', () => {
    expect(weekStartOf(TODAY)).toBe('2026-10-26');
    const { cur, past } = trendWindows('week', TODAY);
    expect(cur).toEqual({ from: '2026-10-26', to: '2026-10-30' });
    expect(past).toHaveLength(8);
    expect(past[0]).toEqual({ from: '2026-10-19', to: '2026-10-23' });
    expect(past[7]).toEqual({ from: '2026-08-31', to: '2026-09-04' });
  });

  test('a month: the 1st to today, and the same days of the 3 months before (a shorter one — to its last day)', () => {
    const { cur, past } = trendWindows('month', '2026-10-31');
    expect(cur).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(past).toEqual([
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-08-01', to: '2026-08-31' },
      { from: '2026-07-01', to: '2026-07-31' },
    ]);
  });
});

describe('trendOf', () => {
  // 250 by the 30th of July – September (one month 300: the median takes the middle), 360 this month
  const cafe = [
    spend('2026-07-05', 23000), spend('2026-07-20', 2000),
    spend('2026-08-03', 25000),
    spend('2026-09-10', 30000), spend('2026-09-30', 9900),
    spend('2026-10-02', 18000), spend('2026-10-29', 18000),
  ];

  test('the month so far against the median of the past months by the same days', () => {
    const t = trendOf(cafe, 'month', TODAY, '2026-06-01')!;
    expect(t.cur).toBe(36000);
    // July 25 000, August 25 000, September 39 900 → 25 000
    expect(t.usual).toBe(25000);
    expect(t.delta).toBe(11000);
    expect(t.pct).toBe(44);
    expect(t.notable).toBe(true);
    expect(t.count).toBe(2);
    // July 2, August 1, September 2
    expect(t.usualCount).toBe(2);
    expect(pctText(t)).toBe('+44% к обычному');
  });

  test('a small change, in % or in money, is not shown', () => {
    // +20%: under 30%
    expect(trendOf([spend('2026-09-05', 10000), spend('2026-08-05', 10000), spend('2026-07-05', 10000), spend('2026-10-05', 12000)], 'month', TODAY, '2026-06-01')!.notable).toBe(false);
    // +200%, but 20 ₾: under 30 ₾
    expect(trendOf([spend('2026-09-05', 1000), spend('2026-08-05', 1000), spend('2026-07-05', 1000), spend('2026-10-05', 3000)], 'month', TODAY, '2026-06-01')!.notable).toBe(false);
  });

  test('nothing usually: no %, "раньше не было"', () => {
    const t = trendOf([spend('2026-10-05', 6450)], 'month', TODAY, '2026-06-01')!;
    expect(t.pct).toBeNull();
    expect(pctText(t)).toBe('раньше не было');
    expect(t.notable).toBe(true);
  });

  test('nothing spent yet: "трат пока нет", not "−100%"', () => {
    const t = trendOf([spend('2026-09-05', 10000), spend('2026-08-05', 10000), spend('2026-07-05', 10000)], 'month', TODAY, '2026-06-01')!;
    expect(t.pct).toBe(-100);
    expect(pctText(t)).toBe('трат пока нет');
  });

  test('tracked for less than the usual takes: none', () => {
    expect(trendOf(cafe, 'month', TODAY, '2026-07-15')).toBeNull();
    expect(trendOf(cafe, 'week', TODAY, '2026-09-10')).toBeNull();
  });
});

describe('why', () => {
  const money = (v: number) => `${Math.round(v / 100)} ₾`;
  const t = (cur: number, count: number, usual: number, usualCount: number) =>
    ({ cur, usual, delta: cur - usual, pct: null, count, usualCount, notable: true });

  test('more purchases at the same check: "Чаще"', () => {
    expect(whyText(t(10500, 7, 6000, 4), money)).toBe('Чаще: 7 покупок вместо 4, средний чек тот же ≈ 15 ₾');
  });
  test('a dearer check: "Дороже", and the count when it moved too', () => {
    expect(whyText(t(12000, 1, 2500, 1), money)).toBe('Дороже: средний чек 120 ₾ вместо 25 ₾');
    expect(whyText(t(12000, 2, 2500, 1), money)).toBe('Дороже: средний чек 60 ₾ вместо 25 ₾, 2 покупки вместо 1');
  });
  test('none this time; nothing usually', () => {
    expect(whyText(t(0, 0, 9000, 3), money)).toBe('Покупок не было, обычно 3 покупки');
    expect(whyText(t(6450, 5, 0, 0), money)).toBeNull();
  });
});

describe('bars', () => {
  test('the week by day: future days empty, each with the median of its weekday', () => {
    // the 8 Wednesdays before: 1000 each
    const wednesdays = ['2026-10-21', '2026-10-14', '2026-10-07', '2026-09-30', '2026-09-23', '2026-09-16', '2026-09-09', '2026-09-02'];
    const spends = [spend('2026-10-28', 3000), ...wednesdays.map((d) => spend(d, 1000))];
    const bars = weekBars(spends, TODAY);
    expect(bars.map((b) => b.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(bars[2]).toEqual({ day: '2026-10-28', value: 3000, usual: 1000 });
    expect(bars[5].value).toBeNull();
  });

  test('12 months, the current one so far; their average, least and most over the full ones since tracking began', () => {
    const bars = monthBars([spend('2026-10-02', 500), spend('2026-09-02', 300), spend('2026-08-02', 100), spend('2025-11-30', 700)], TODAY);
    expect(bars).toHaveLength(12);
    expect(bars[0]).toEqual({ ym: '2025-11', value: 700 });
    expect(bars[11]).toEqual({ ym: '2026-10', value: 500 });
    // tracked from 15 July: August and September are the full months
    const s = monthsSummary(bars, '2026-07-15')!;
    expect(s.average).toBe(200);
    expect(s.least).toEqual({ ym: '2026-08', value: 100 });
    expect(s.most).toEqual({ ym: '2026-09', value: 300 });
    expect(s.total).toBe(1600);
  });

  test('the weekdays: the average of each over the full weeks before this one', () => {
    // Fridays of the 13 weeks before: 2 of them 1300
    const h = weekdayHabits([spend('2026-10-23', 1300), spend('2026-10-16', 1300), spend('2026-10-28', 9999)], TODAY, '2025-01-01');
    expect(h[4]).toBe(200);
    expect(h[2]).toBe(0);
  });

  test('the merchants of the period, most first', () => {
    // SPAR: last week
    const m = topMerchants([spend('2026-10-27', 4000, 'BURGER HOUSE'), spend('2026-10-28', 3000, 'GLOVO'), spend('2026-10-29', 1500, 'GLOVO'), spend('2026-10-20', 9000, 'SPAR')], 'week', TODAY);
    expect(m).toEqual([{ key: 'GLOVO', name: 'GLOVO', value: 4500 }, { key: 'BURGER HOUSE', name: 'BURGER HOUSE', value: 4000 }]);
  });
});

describe('the lists and a category page', () => {
  const category = (id: number, compared = true) => ({ id, name: `К${id}`, emoji: null, type_name: null, color: '#000000', compared });
  const usual = (id: number, v: number) => ['2026-07-05', '2026-08-05', '2026-09-05'].map((d) => spend(d, v, null, id));
  const data: TrendsData = {
    since: '2026-01-01',
    categories: [category(1), category(2), category(3), category(4, false)],
    spends: [
      ...usual(1, 10000), spend('2026-10-05', 30000, null, 1),
      ...usual(2, 10000), spend('2026-10-05', 17000, null, 2),
      ...usual(3, 10000),
      // a regular payment, paid later this month: not compared
      ...usual(4, 150000),
    ],
  };

  test('more: by how much, most first; less; not compared — out', () => {
    const l = trendLists(data, 'month', TODAY);
    expect(l.more.map((r) => r.category.id)).toEqual([1, 2]);
    expect(l.less.map((r) => r.category.id)).toEqual([3]);
    expect(l.early).toBe(false);
    expect(l.more[0].bars).toHaveLength(12);
    expect(l.more[0].bars.slice(-4).map((b) => b.tone)).toEqual(['base', 'base', 'base', 'now']);
  });

  test('too little history: "early"', () => {
    expect(trendLists({ ...data, since: '2026-10-01' }, 'month', TODAY).early).toBe(true);
  });

  test('a category page: the trend, the period, the operations of it', () => {
    const v = categoryTrendView(data, 1, 'month', TODAY)!;
    expect(v.trend!.delta).toBe(20000);
    expect(v.window).toEqual({ from: '2026-10-01', to: TODAY });
    expect(v.count).toBe(1);
    expect(categoryTrendView(data, 99, 'month', TODAY)).toBeNull();
  });
});
