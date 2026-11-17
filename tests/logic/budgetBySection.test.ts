// 5.1.21 the month's ring in «План»: the budget by the sections.
import { budgetBySection } from '../../src/screens/stats/month/model/budgetBySection';

const g = (id: string, planned: number, spent: number) => ({ id, title: id, planned, spent, color: '#000' });
const none = { id: 'u', share: 0, spent: 0, color: '' };

test('a piece per planned section, «Вне плана», «Сбережения», what is free; how much of each is spent', () => {
  const pieces = budgetBySection({
    groups: [g('Жизнь', 500, 600), g('Хобби', 100, 25), g('Пусто', 0, 10)],
    unplanned: { id: 'u', share: 100, spent: 50, color: '#999' },
    savings: { id: 's', share: 0.2, done: 0.5, color: '#0f0' },
    base: 1000,
  });
  expect(pieces.map((p) => [p.title, p.share, p.done])).toEqual([
    ['Жизнь', 0.5, 1.2], ['Хобби', 0.1, 0.25], ['Вне плана', 0.1, 0.5], ['Сбережения', 0.2, 0.5], ['Свободно', expect.closeTo(0.1), 0],
  ]);
});

test('the whole budget in one section, or no base: nothing to split', () => {
  expect(budgetBySection({ groups: [g('Жизнь', 1000, 0)], unplanned: none, savings: null, base: 1000 })).toEqual([]);
  expect(budgetBySection({ groups: [g('Жизнь', 500, 0)], unplanned: none, savings: null, base: 0 })).toEqual([]);
});
