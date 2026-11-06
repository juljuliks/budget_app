// The long press's buttons around the finger: an arc over it, under it near the top, pushed in at the sides.
import { buttonAt, menuLayout, movedFrom } from '../../src/shared/lib/pressMenu';

const round = (ps: Array<{ x: number; y: number }>) => ps.map((p) => [Math.round(p.x), Math.round(p.y)]);

test('three buttons in an arc over the finger: left, straight up, right', () => {
  expect(round(menuLayout({ x: 200, y: 500 }, 3, 412))).toEqual([[120, 433], [200, 396], [280, 433]]);
});

test('no room over it (the header): under the finger', () => {
  expect(round(menuLayout({ x: 200, y: 180 }, 3, 412))).toEqual([[120, 247], [200, 284], [280, 247]]);
});

test('at a side: the arc pushed inwards, none crossing the edge', () => {
  const left = menuLayout({ x: 30, y: 500 }, 3, 412);
  expect(Math.min(...left.map((p) => p.x)) - 28).toBeGreaterThanOrEqual(12);
  const right = menuLayout({ x: 400, y: 500 }, 3, 412);
  expect(Math.max(...right.map((p) => p.x)) + 28).toBeLessThanOrEqual(400);
});

test('the button under the finger, the nearest; none away from them; a drag past a few points', () => {
  const b = menuLayout({ x: 200, y: 500 }, 3, 412);
  expect(buttonAt(b, { x: 205, y: 400 })).toBe(1);
  expect(buttonAt(b, { x: 275, y: 440 })).toBe(2);
  expect(buttonAt(b, { x: 200, y: 600 })).toBeNull();
  expect(movedFrom({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false);
  expect(movedFrom({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe(true);
});
