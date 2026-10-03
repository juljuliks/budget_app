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

/** "Без категории" and anything unknown. */
export const NEUTRAL_COLOR = '#c3c2b7';

export function isPaletteKey(v: string | null | undefined): v is PaletteKey {
  return !!v && v in PALETTES;
}

/** A type's palette: its own, or one by its position among the types. */
export function typePalette(type: { palette: string | null }, typeIndex: number): PaletteKey {
  return isPaletteKey(type.palette) ? type.palette : PALETTE_ORDER[typeIndex % PALETTE_ORDER.length];
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
  // untyped categories take the base colors of palettes no type uses, so they don't pass for a type's member
  const taken = new Set(paletteOf.values());
  const free = UNTYPED_COLORS.filter((_, i) => !taken.has(PALETTE_ORDER[i]));
  const untyped = free.length > 0 ? free : UNTYPED_COLORS;
  const seen = new Map<number | null, number>(); // per type: how many categories got a shade so far
  const out = new Map<number, string>();
  for (const c of categories) {
    const n = seen.get(c.type_id) ?? 0;
    seen.set(c.type_id, n + 1);
    if (c.color) { out.set(c.id, c.color); continue; }
    const palette = c.type_id !== null ? paletteOf.get(c.type_id) : undefined;
    out.set(c.id, palette ? PALETTES[palette].shades[n % PALETTES[palette].shades.length] : untyped[n % untyped.length]);
  }
  return out;
}
