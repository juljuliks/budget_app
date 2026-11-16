// Where the buttons of a long press stand around the finger (four: a diamond around it — left, top, right, bottom; two or
// three: an arc over it, under it near the top; pushed in at the sides) and which one the finger is over.

export type Point = { x: number; y: number };

/** a button's radius, its label under it included in the reach */
export const BUTTON_RADIUS = 28;
/** how far from the finger the arc is: clear of the finger, close enough to reach without lifting it */
const REACH = 104;
/** four buttons, a diamond: each this far from the finger, left / right / up / down */
const DIAMOND = 100;
/** under the diamond: the label and the tab bar kept clear */
const BOTTOM = 96;
/** the edges kept clear: the screen's sides, and over the arc its top (the header) */
const SIDE = 12;
const TOP = 96;
/** the finger counts as over a button this close to its center */
const HIT = 44;

/**
 * The buttons' centers for `count` (2–4) actions: four — a diamond around the finger, left, top, right, bottom (moved down
 * under the header, up over the screen's bottom, `height` high); else left to right an arc over the finger, or under it
 * when there is no room above; shifted inwards so none crosses a side of a screen `width` wide.
 */
export function menuLayout(finger: Point, count: number, width: number, height = Infinity): Point[] {
  if (count === 4) return diamond(finger, width, height);
  const up = finger.y - REACH - BUTTON_RADIUS > TOP;
  const sign = up ? -1 : 1;
  // the arc's angles from straight up / down: the middle one there, the others at ±50°
  const angles = count === 3 ? [-50, 0, 50] : count === 2 ? [-30, 30] : [0];
  const points = angles.map((a) => {
    const r = (a * Math.PI) / 180;
    return { x: finger.x + REACH * Math.sin(r), y: finger.y + sign * REACH * Math.cos(r) };
  });
  const min = Math.min(...points.map((p) => p.x)) - BUTTON_RADIUS - SIDE;
  const max = Math.max(...points.map((p) => p.x)) + BUTTON_RADIUS + SIDE;
  const shift = min < 0 ? -min : max > width ? width - max : 0;
  return points.map((p) => ({ x: p.x + shift, y: p.y }));
}

/** Four buttons around the finger: left, top, right, bottom; the whole diamond kept inside the screen. */
function diamond(f: Point, width: number, height: number): Point[] {
  const top = f.y - DIAMOND - BUTTON_RADIUS;
  const bottom = f.y + DIAMOND + BUTTON_RADIUS;
  const dy = top < TOP ? TOP - top : bottom > height - BOTTOM ? height - BOTTOM - bottom : 0;
  const left = f.x - DIAMOND - BUTTON_RADIUS - SIDE;
  const right = f.x + DIAMOND + BUTTON_RADIUS + SIDE;
  const dx = left < 0 ? -left : right > width ? width - right : 0;
  const c = { x: f.x + dx, y: f.y + dy };
  return [{ x: c.x - DIAMOND, y: c.y }, { x: c.x, y: c.y - DIAMOND }, { x: c.x + DIAMOND, y: c.y }, { x: c.x, y: c.y + DIAMOND }];
}

/** The button the finger is over, null — none. */
export function buttonAt(buttons: Point[], p: Point): number | null {
  let best: number | null = null;
  let bestD = HIT;
  buttons.forEach((b, i) => {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d <= bestD) { best = i; bestD = d; }
  });
  return best;
}

/** Moved this far from where it was pressed: a drag (release = choose), not a release in place (the buttons stay). */
export const MOVED = 12;
export const movedFrom = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) > MOVED;
