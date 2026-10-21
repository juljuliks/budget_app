// The shared category list: search, "Без категории", section order (entities/category/model/chooseList.ts).
import type { Category } from '../../src/db/categories';
import { matchesQuery, orderedSections, showNone } from '../../src/entities/category/model/chooseList';

const cat = (p: Partial<Category> & Pick<Category, 'id' | 'name'>): Category => ({
  emoji: null, sort_order: 0, type_id: null, type_name: null, type_is_transfer: 0,
  deleted_at: null, color: null, system: null, recurring: 0, by_merchant: 0, ...p,
});

const food = cat({ id: 1, name: 'Продукты', emoji: '🛒', type_name: 'Жизнь' });
const mom = cat({ id: 2, name: 'Маме', emoji: '👩', type_name: 'Переводы', type_is_transfer: 1 });
const cafe = cat({ id: 3, name: 'Кафе', type_name: null });
const topUp = cat({ id: 4, name: 'Пополнение счёта', emoji: '💳', system: 'topup' });
const all = [food, mom, cafe, topUp];

test('search folds case and ё, and "Без категории" is searched too', () => {
  expect(matchesQuery('Ёлка', 'елка')).toBe(true);
  expect(matchesQuery('Ёлка', 'кафе')).toBe(false);
  expect(matchesQuery('Кафе', '')).toBe(true);
  expect(showNone('без', true)).toBe(true);
  expect(showNone('еда', true)).toBe(false);
  expect(showNone('', false)).toBe(false);
});

test('sections keep their order; a search drops the empty ones; exclusions go', () => {
  expect(orderedSections(all, { query: '' }).map((s) => s.title)).toEqual(['Жизнь', 'Переводы', 'Без раздела']);
  expect(orderedSections(all, { query: 'ма' }).map((s) => [s.title, s.data.map((c) => c.name)])).toEqual([['Переводы', ['Маме']]]);
  expect(orderedSections(all, { query: '', excludeIds: [1] }).flatMap((s) => s.data.map((c) => c.id))).not.toContain(1);
});

test('a transfer leads with its section; a deposit leads with the top-up, then transfers; the top-up is hidden otherwise', () => {
  expect(orderedSections(all, { query: '', transferFirst: true }).map((s) => s.title)).toEqual(['Переводы', 'Жизнь', 'Без раздела']);
  expect(orderedSections(all, { query: '' }).flatMap((s) => s.data.map((c) => c.id))).not.toContain(4);
  const deposit = orderedSections(all, { query: '', deposit: true });
  expect(deposit.map((s) => s.title)).toEqual([null, 'Переводы', 'Жизнь', 'Без раздела']);
  expect(deposit[0].data.map((c) => c.name)).toEqual(['Пополнение счёта']);
});
