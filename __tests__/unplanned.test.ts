import type { CategoryStat, StatGroup } from '../src/db/plans';
import { splitUnplanned } from '../src/ui/stats/unplanned';

const cat = (id: number | null, spent: number, limit: number | null, type_id: number | null = 1): CategoryStat => ({
  category_id: id, name: `c${id}`, emoji: null, type_id, type_name: null, spent_minor: spent, limit_minor: limit,
  plan_kind: limit === null ? null : 'limit', plan_norm: null, color: '#000', deleted: false,
});
const group = (title: string, cats: CategoryStat[]): StatGroup => ({
  type_id: cats[0].type_id, title, categories: cats,
  spent_minor: cats.reduce((s, c) => s + c.spent_minor, 0), planned_minor: cats.reduce((s, c) => s + (c.limit_minor ?? 0), 0),
});

test('the categories without a plan and the uncategorized leave their sections for one, the biggest first', () => {
  const groups = [
    group('Жизнь', [cat(1, 500, 1000), cat(2, 300, null)]),
    group('Развлечения', [cat(3, 700, null)]),
    group('Без категории', [cat(null, 200, null, null)]),
  ];
  const r = splitUnplanned(groups, (c) => c.limit_minor !== null);
  expect(r.groups.map((g) => [g.title, g.spent_minor, g.planned_minor, g.categories.map((c) => c.category_id)])).toEqual([['Жизнь', 500, 1000, [1]]]);
  expect(r.unplanned.map((c) => c.category_id)).toEqual([3, 2, null]);
  expect(r.spent).toBe(1200);
});

test('a refund bigger than the spending counts as nothing in the total', () => {
  const r = splitUnplanned([group('Жизнь', [cat(2, -100, null), cat(4, 300, null)])], () => false);
  expect(r.spent).toBe(300);
  expect(r.groups).toEqual([]);
});
