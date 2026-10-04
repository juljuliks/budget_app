// Category colors. A category type has a palette (a hue with several shades) and its categories take
// those shades in order, so a type reads as one color family on the charts. Categories without a type
// get distinct base colors. A category's own color (picked in its editor) always wins.

export type PaletteKey = 'blue' | 'orange' | 'green' | 'amber' | 'pink' | 'purple' | 'teal' | 'red';

/** Shades are ordered so neighbours differ in lightness (siblings stay distinguishable). */
export const PALETTES: Record<PaletteKey, { label: string; shades: string[] }> = {
  blue: { label: 'Синяя', shades: ['#2a78d6', '#7fb0ec', '#1d5aa6', '#aacbf3', '#123f78'] },
  orange: { label: 'Оранжевая', shades: ['#eb6834', '#f39f74', '#b84a1e', '#f7c1a3', '#8a3613'] },
  green: { label: 'Зелёная', shades: ['#1baf7a', '#62d0a6', '#13835b', '#9ce2c6', '#0c5c40'] },
  amber: { label: 'Янтарная', shades: ['#eda100', '#f6c45a', '#b37800', '#fadb98', '#7d5400'] },
  pink: { label: 'Розовая', shades: ['#e87ba4', '#f2a9c5', '#c0517d', '#f7cddd', '#8f3359'] },
  purple: { label: 'Фиолетовая', shades: ['#8b5cf6', '#b296f9', '#6d3fd6', '#d2c2fc', '#4c2a9e'] },
  teal: { label: 'Бирюзовая', shades: ['#14a3b8', '#5ec8d7', '#0e7a8a', '#9ddfe8', '#09535e'] },
  red: { label: 'Красная', shades: ['#d03b3b', '#e27777', '#a12a2a', '#eea6a6', '#701c1c'] },
};

export const PALETTE_ORDER: PaletteKey[] = ['blue', 'orange', 'green', 'amber', 'pink', 'purple', 'teal', 'red'];

/** Categories without a type: one base color each. */
export const UNTYPED_COLORS = PALETTE_ORDER.map((k) => PALETTES[k].shades[0]).concat(['#7a8b99']);

/**
 * Colors for untyped categories, in the order they are handed out: the base colors of the palettes no type uses
 * (and grey), then those palettes' other shades — so many untyped categories don't repeat a color.
 */
export function untypedColors(typePalettes: string[]): string[] {
  const free = PALETTE_ORDER.filter((k) => !typePalettes.includes(k));
  const pals = free.length > 0 ? free : PALETTE_ORDER;
  const out = pals.map((k) => PALETTES[k].shades[0]).concat(['#7a8b99']);
  for (let level = 1; level < 5; level++) out.push(...pals.map((k) => PALETTES[k].shades[level]));
  return out;
}

/** "Без категории" and anything unknown. */
export const NEUTRAL_COLOR = '#c3c2b7';

export function isPaletteKey(v: string | null | undefined): v is PaletteKey {
  return !!v && v in PALETTES;
}

/** A palette of the user's own: its base color, '#rrggbb' (the shades are derived from it, see shadesFromBase). */
export function isCustomPalette(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-f]{6}$/i.test(v);
}

/**
 * A type's palette: a preset key or a custom base color (stored on the type), otherwise a preset by its position
 * among the types.
 */
export function typePalette(type: { palette: string | null }, typeIndex: number): string {
  if (isPaletteKey(type.palette) || isCustomPalette(type.palette)) return type.palette;
  return PALETTE_ORDER[typeIndex % PALETTE_ORDER.length];
}

/** The shades of a palette (a preset key or a custom base color). */
export function paletteShades(palette: string): string[] {
  return isPaletteKey(palette) ? PALETTES[palette].shades : shadesFromBase(palette);
}

// --- color math (hex <-> HSL) for custom colors and palettes ---

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, sat * 100, l * 100];
}

export function hslToHex(h: number, sat: number, l: number): string {
  const s1 = Math.max(0, Math.min(100, sat)) / 100, l1 = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s1 * Math.min(l1, 1 - l1);
  const f = (n: number) => l1 - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** A custom color from a hue (0..360): saturated and mid-light like the presets' base shades. */
export function colorFromHue(hue: number, lightness = 48): string {
  return hslToHex(hue, 68, lightness);
}

/**
 * Five shades of a base color, ordered like the presets' (base, lighter, darker, lightest, darkest) so
 * neighbouring categories of a type differ in lightness.
 */
export function shadesFromBase(base: string): string[] {
  const [h, sat, l] = hexToHsl(base);
  return [l, l + 17, l - 13, l + 30, l - 24].map((x) => hslToHex(h, sat, Math.max(14, Math.min(88, x))));
}

/** Hue distance on the color wheel, 0..180. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * A hue as far as possible from the (saturated) colors already used, with a little randomness so pressing
 * "случайный" again gives another one.
 */
export function distinctHue(taken: Iterable<string>, random = Math.random): number {
  const hues = [...taken].map(hexToHsl).filter(([, sat]) => sat > 15).map(([h]) => h);
  if (hues.length === 0) return Math.floor(random() * 360);
  let best = 0, bestGap = -1;
  for (let i = 0; i < 36; i++) {
    const h = (i * 10 + random() * 10) % 360;
    const gap = Math.min(...hues.map((t) => hueGap(h, t))) + random() * 8;
    if (gap > bestGap) { best = h; bestGap = gap; }
  }
  return Math.round(best);
}

/**
 * Color of every category. `categories` and `types` must be in display order (type order, then category
 * order) so a category keeps its shade as long as the list doesn't change.
 */
export function buildCategoryColors(
  categories: Array<{ id: number; type_id: number | null; color: string | null }>,
  types: Array<{ id: number; palette: string | null }>,
): Map<number, string> {
  const paletteOf = new Map(types.map((t, i) => [t.id, typePalette(t, i)]));
  // untyped categories take the colors of palettes no type uses, so they don't pass for a type's member
  const untyped = untypedColors([...paletteOf.values()]);
  const seen = new Map<number | null, number>(); // per type: how many categories got a shade so far
  const out = new Map<number, string>();
  for (const c of categories) {
    const n = seen.get(c.type_id) ?? 0;
    seen.set(c.type_id, n + 1);
    if (c.color) { out.set(c.id, c.color); continue; }
    const palette = c.type_id !== null ? paletteOf.get(c.type_id) : undefined;
    const shades = palette ? paletteShades(palette) : untyped;
    out.set(c.id, shades[n % shades.length]);
  }
  return out;
}

/** Palettes a type may pick: its own plus those no other type uses (all of them once every one is taken). */
export function freePalettes(types: Array<{ id: number; palette: string | null }>, typeId: number): PaletteKey[] {
  const taken = new Set(types.map((t, i) => (t.id === typeId ? null : typePalette(t, i))));
  const free = PALETTE_ORDER.filter((k) => !taken.has(k));
  return free.length > 0 ? free : PALETTE_ORDER;
}

/**
 * Colors a category may pick: its type's shades, then the base colors of palettes no type uses, minus the
 * colors other live categories already have (`taken`). Its current color is always offered.
 */
export function freeCategoryColors(
  types: Array<{ id: number; palette: string | null }>,
  typeId: number | null,
  taken: Set<string>,
  current: string | null,
): string[] {
  const palettes = types.map((t, i) => typePalette(t, i));
  const own = typeId === null ? null : palettes[types.findIndex((t) => t.id === typeId)] ?? null;
  const options = [
    ...(own ? paletteShades(own) : []),
    // the untyped colors in their order: once the free palettes' base colors are taken, their other shades
    ...untypedColors(palettes).filter((c) => !taken.has(c)).slice(0, 8),
  ].filter((c) => !taken.has(c) || c === current);
  return current && !options.includes(current) ? [current, ...options] : options;
}
