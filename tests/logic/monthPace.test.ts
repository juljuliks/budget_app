// The marks over the month's bar (screens/stats/month/model/monthPace.ts): those too near drawn as one keep their
// payments — a tap on it names each.
import { BarMark, clusterMarks } from '../../src/screens/stats/month/model/monthPace';

const mark = (key: string, at: number, status: BarMark['status']): BarMark =>
  ({ key, at, category_id: 1, emoji: '🏠', name: key, day: '2026-11-03', minor: 100, status });

test('the near ones are one: their count, the worst state, every payment in it', () => {
  const shown = clusterMarks([mark('a', 0.1, 'paid'), mark('b', 0.12, 'ahead'), mark('c', 0.5, 'paid')], 0.05);
  expect(shown.map((m) => ({ key: m.key, count: m.count, status: m.status, members: m.members.map((x) => x.key) }))).toEqual([
    { key: 'a', count: 2, status: 'ahead', members: ['a', 'b'] },
    { key: 'c', count: 1, status: 'paid', members: ['c'] },
  ]);
});

test('a group drawn wider (its icons side by side): the next mark measured from its last icon', () => {
  // gap 0.05, each next icon 0.03 further: a, b at 0.12 — one; c at 0.18 is within the gap of b's icon (0.13) — in it too
  const shown = clusterMarks([mark('a', 0.1, 'paid'), mark('b', 0.12, 'paid'), mark('c', 0.17, 'paid'), mark('d', 0.3, 'paid')], 0.05, 0.03);
  expect(shown.map((m) => m.members.map((x) => x.key))).toEqual([['a', 'b', 'c'], ['d']]);
});
