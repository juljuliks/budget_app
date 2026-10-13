// The plan screen's arithmetic (screens/stats/plan/model/planView): the budget's split, the sections, the norms.
import { groupByType, normText, percentOf, planView } from '../../src/screens/stats/plan/model/planView';
import { savingsLess } from '../../src/screens/stats/plan/model/savingsLess';
import type { PlanBudget, PlanItem } from '../../src/db/plans';

const item = (p: Partial<PlanItem>): PlanItem => ({
  category_id: 1, name: 'Продукты', emoji: '🛒', type_id: 1, type_name: 'Жизнь', limit_minor: 31000, currency: 'GEL',
  converted_minor: 31000, kind: 'limit', norm_period: 'week', pinned: false, previous_minor: null, ...p,
});
const budget = (p: Partial<PlanBudget>): PlanBudget => ({
  amount_minor: 100000, currency: 'GEL', unplanned_pct: 0, to_savings: false, locked_minor: 0, unplanned_minor: null, carry: null, ...p,
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

test('the budget\'s split: planned, outside the plan, savings (🔒 and what the plan leaves — "Итоги месяца" decide)', () => {
  const v = view([item({})], budget({ unplanned_pct: 20 } as Partial<PlanBudget>));
  expect(v.parts.map((p) => [p.label, p.value, p.note])).toEqual([['План', 31000, '31%'], ['Вне плана', 20000, '20%'], ['Сбережения', 49000, '49%']]);
  const s = view([item({})], budget({ locked_minor: 10000 }));
  expect(s.parts.find((p) => p.key === 'free')).toMatchObject({ label: 'Сбережения', value: 69000, note: '69%' });
  expect(s.systemGroups.map((g) => [g.title, g.rows.map((r) => r.name)])).toEqual([['Сбережения', ['🔒 Сразу', '🌊 Что осталось']]]);
  expect(s.systemGroups[0].rows[1].note).toBe('не запланировано — решите в итогах месяца');
});

test('what the month before sent: owed — red first, out of what is left; moved in — on top of the budget, a line under it', () => {
  const debt = view([item({})], budget({ carry: { from_ym: '2029-12', debt_minor: 5000, plus_minor: 0 } }));
  expect(debt.parts.map((p) => [p.label, p.value])).toEqual([['Перерасход декабря', 5000], ['План', 31000], ['Вне плана', 0], ['Сбережения', 64000]]);
  expect(debt.systemGroups[0]).toMatchObject({ title: 'Перенос из декабря', rows: [{ name: '⚠️ Перерасход декабря', note: 'вычтен из бюджета января', carry: 'debt' }] });
  const plus = view([item({})], budget({ carry: { from_ym: '2029-12', debt_minor: 0, plus_minor: 20000 } }));
  expect(plus).toMatchObject({ shownBudget: 120000, budgetSub: '1\u00a0000\u00a0₾ + 200\u00a0₾ из декабря' });
  expect(plus.parts.map((p) => p.label)).toEqual(['План', 'Вне плана', 'Сбережения']);
  expect(plus.systemGroups[0].rows).toEqual([expect.objectContaining({ name: '➕ Остаток декабря', value: 20000, carry: 'plus' })]);
});

test('no budget: no split, the hint asks for one', () => {
  const v = view([item({})], null);
  expect(v.parts).toEqual([]);
  expect(v.budgetHint).toBe('Уже запланировано: 310\u00a0₾');
});

test('the overspend takes the savings: 🌊 first, then 🔒; the biggest overspend first; under a unit — nothing', () => {
  const items = [item({ category_id: 1, converted_minor: 30000 }), item({ category_id: 2, name: 'Такси', converted_minor: 10000 })];
  const spentBy = (a: number, b: number) => ({ byCategory: new Map([[1, a], [2, b]]), total: a + b });
  const l = savingsLess({ items, spentBy: spentBy(38050, 13529), unplanned: 5000, unplannedSpent: 4000, free: 25732, locked: 259940 })!;
  expect(l).toMatchObject({ less: 11579, was: 285672, now: 274093, free: { was: 25732, now: 14153 }, locked: { was: 259940, now: 259940 } });
  expect(l.overs.map((o) => [o.name, o.over])).toEqual([['Продукты', 8050], ['Такси', 3529]]);
  // past the leftover: into 🔒; spending outside the plan past its share, a row of its own
  const big = savingsLess({ items, spentBy: spentBy(60000, 10000), unplanned: 5000, unplannedSpent: 8000, free: 25000, locked: 100000 })!;
  expect(big).toMatchObject({ less: 33000, free: { now: 0 }, locked: { now: 92000 } });
  expect(big.overs.map((o) => o.key)).toEqual(['1', 'unplanned']);
  expect(savingsLess({ items, spentBy: spentBy(30050, 0), unplanned: 0, unplannedSpent: 0, free: 1000, locked: 0 })).toBeNull();
});

test('what the budget sheet\'s parts can\'t take: the plan, the funds, what the month before owes, less what it moved in', () => {
  const fund = item({ category_id: 3, kind: 'fund', converted_minor: 5000 });
  expect(view([item({}), fund], budget({})).claimed).toBe(36000);
  expect(view([item({})], budget({ carry: { from_ym: '2029-12', debt_minor: 4000, plus_minor: 0 } })).claimed).toBe(35000);
  expect(view([item({})], budget({ carry: { from_ym: '2029-12', debt_minor: 0, plus_minor: 10000 } })).claimed).toBe(21000);
});
