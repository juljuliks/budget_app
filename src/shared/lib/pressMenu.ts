// Where the buttons of a long press stand around the finger (four: a cross close around it, on a plate of its
// shape, their labels outside — left, top, right, bottom; two or three: an arc over it, under it near the top; pushed in at the sides) and which one the
// finger is over.

export type Point = { x: number; y: number };

/** a button's radius */
export const BUTTON_RADIUS = 28;
/** how far from the finger the arc is: clear of the finger, close enough to reach without lifting it */
const REACH = 104;
/** four buttons, a cross: each this far from the finger, left / right / up / down — the circles close, a little apart */
export const CROSS = 50;
/** the cross's plate: this much past the circles */
export const PLATE_PAD = 8;
/** the cross's labels outside it, each beyond its button (this wide, this high), this far from the circle */
export const LABEL_W = 96;
export const LABEL_H = 20;
export const LABEL_GAP = 14;
/** the cross: the finger counts as over a button this close to its center (its middle — over none) */
const CROSS_HIT = 30;
/** under the cross: the label and the tab bar kept clear */
const BOTTOM = 96;
/** the edges kept clear: the screen's sides, and over the arc its top (the header) */
const SIDE = 12;
const TOP = 96;
/** the finger counts as over a button this close to its center */
const HIT = 44;

/**
 * The buttons' centers for `count` (2–4) actions: four — a cross around the finger, left, top, right, bottom (moved down
 * under the header, up over the screen's bottom, `height` high); else left to right an arc over the finger, or under it
 * when there is no room above; shifted inwards so none crosses a side of a screen `width` wide.
 */
export function menuLayout(finger: Point, count: number, width: number, height = Infinity): Point[] {
  if (count === 4) return cross(finger, width, height);
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

/** Four buttons around the finger: left, top, right, bottom; the whole cross with its labels kept inside the screen. */
function cross(f: Point, width: number, height: number): Point[] {
  // from the middle to a label's far edge, up / down and to the sides
  const v = CROSS + BUTTON_RADIUS + LABEL_GAP + LABEL_H;
  const hz = CROSS + BUTTON_RADIUS + LABEL_GAP + LABEL_W;
  const top = f.y - v;
  const bottom = f.y + v;
  const dy = top < TOP ? TOP - top : bottom > height - BOTTOM ? height - BOTTOM - bottom : 0;
  const left = f.x - hz - SIDE;
  const right = f.x + hz + SIDE;
  const dx = left < 0 ? -left : right > width ? width - right : 0;
  const c = { x: f.x + dx, y: f.y + dy };
  return [{ x: c.x - CROSS, y: c.y }, { x: c.x, y: c.y - CROSS }, { x: c.x + CROSS, y: c.y }, { x: c.x, y: c.y + CROSS }];
}

/**
 * The outline of the cross's plate as an SVG path, its middle at (cx, cy): a bar `w` to each side from `up` over to
 * `down` under the middle, and one `h` to each side from `vUp` over to `vDown` under; the outer corners rounded by `r`
 * (half a bar's width: its end a half circle), the inner ones by `ri`.
 */
export function crossPath(cx: number, cy: number, s: { w: number; h: number; up: number; down: number; vUp: number; vDown: number; r: number; ri: number }): string {
  const { w, h, up, down, vUp, vDown, r, ri } = s;
  // clockwise from the top bar's left corner; the inner corners (where the bars meet) turn the other way
  type Corner = [number, number, number, boolean];
  const pts: Corner[] = [
    [-h, -vUp, r, true], [h, -vUp, r, true], [h, -up, ri, false], [w, -up, r, true], [w, down, r, true], [h, down, ri, false],
    [h, vDown, r, true], [-h, vDown, r, true], [-h, down, ri, false], [-w, down, r, true], [-w, -up, r, true], [-h, -up, ri, false],
  ];
  const at = (i: number) => pts[(i + pts.length) % pts.length];
  const toward = (a: Corner, b: Corner, d: number) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len];
  };
  const xy = (p: number[]) => `${(cx + p[0]).toFixed(1)} ${(cy + p[1]).toFixed(1)}`;
  // each corner: a line to `rad` before it, a quarter circle round it to `rad` after it
  return pts.map((p, i) => {
    const before = toward(p, at(i - 1), p[2]);
    const after = toward(p, at(i + 1), p[2]);
    return `${i === 0 ? 'M' : 'L'}${xy(before)} A${p[2]} ${p[2]} 0 0 ${p[3] ? 1 : 0} ${xy(after)}`;
  }).join(' ') + ' Z';
}

/** The button the finger is over, null — none. */
export function buttonAt(buttons: Point[], p: Point): number | null {
  let best: number | null = null;
  // the cross's buttons are nearer the finger than HIT: its middle must be over none
  let bestD = buttons.length === 4 ? CROSS_HIT : HIT;
  buttons.forEach((b, i) => {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d <= bestD) { best = i; bestD = d; }
  });
  return best;
}

/** Moved this far from where it was pressed: a drag (release = choose), not a release in place (the buttons stay). */
export const MOVED = 12;
export const movedFrom = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) > MOVED;
