// The plan screen's arithmetic (screens/stats/plan/model/planView): the budget's split, the sections, the norms.
import { groupByType, normText, percentOf, planView } from '../../src/screens/stats/plan/model/planView';
import type { PlanBudget, PlanItem } from '../../src/db/plans';

const item = (p: Partial<PlanItem>): PlanItem => ({
  category_id: 1, name: 'Продукты', emoji: '🛒', type_id: 1, type_name: 'Жизнь', limit_minor: 31000, currency: 'GEL',
  converted_minor: 31000, kind: 'limit', norm_period: 'week', pinned: false, previous_minor: null, ...p,
});
const budget = (p: Partial<PlanBudget>): PlanBudget => ({
  amount_minor: 100000, currency: 'GEL', unplanned_pct: 0, to_savings: false, locked_minor: 0, unplanned_minor: null, ...p,
} as PlanBudget);
const view = (items: PlanItem[], b: PlanBudget | null, ym = '2030-01') => planView({
  ym, currency: 'GEL', items, budget: b, toShown: (m) => m, income: 0, unplannedSpentMinor: 0,
  spentBy: { byCategory: new Map(), total: 0 }, hidden: false,
});

test('a limit per its rhythm: the month\'s plan / days × days', () => {
  // October: 310 ₾ / 31 × 7 = 70 ₾ a week
  expect(normText(item({}), '2026-10', 'GEL')).toBe('лимит ≈ 70\u00a0₾ в неделю');
  expect(normText(item({ norm_period: 'month' }), '2026-10', 'GEL')).toBe('крупно, раз в месяц');
  expect(normText(item({ converted_minor: 0 }), '2026-10', 'GEL')).toBe('');
});

test('a share of the budget: none for nothing, "<1%" for a sliver', () => {
  expect(percentOf(25000, 100000)).toBe('25%');
  expect(percentOf(100, 100000)).toBe('<1%');
  expect(percentOf(0, 100000)).toBe('');
});

test('the items by type, in their order; totals of the converted amounts', () => {
  const g = groupByType([item({}), item({ category_id: 2, converted_minor: 5000 }), item({ category_id: 3, type_name: null, converted_minor: null })]);
  expect(g.map((x) => [x.title, x.planned, x.items.length])).toEqual([['Жизнь', 36000, 2], ['Без раздела', 0, 1]]);
});

test('the budget\'s split: planned, outside the plan, free; savings instead of free', () => {
  const v = view([item({})], budget({ unplanned_pct: 20 } as Partial<PlanBudget>));
  expect(v.parts.map((p) => [p.label, p.value, p.note])).toEqual([['План', 31000, '31%'], ['Вне плана', 20000, '20%'], ['Свободно', 49000, '49%']]);
  const s = view([item({})], budget({ to_savings: true, locked_minor: 10000 }));
  expect(s.parts.find((p) => p.key === 'free')).toMatchObject({ label: 'Сбережения', value: 69000, note: '69%' });
  expect(s.systemGroups.map((g) => [g.title, g.rows.map((r) => r.name)])).toEqual([['Сбережения', ['🔒 Сразу', '🌊 Что осталось']]]);
});

test('no budget: no split, the hint asks for one', () => {
  const v = view([item({})], null);
  expect(v.parts).toEqual([]);
  expect(v.budgetHint).toBe('Уже запланировано: 310\u00a0₾');
});
