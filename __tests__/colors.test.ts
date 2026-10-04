import { buildCategoryColors, freeCategoryColors, freePalettes, PALETTE_ORDER, PALETTES, UNTYPED_COLORS } from '../src/colors';

test('a type colors its categories with its palette shades, in order; own color wins; untyped get base colors', () => {
  const colors = buildCategoryColors(
    [
      { id: 1, type_id: 10, color: null },
      { id: 2, type_id: 10, color: '#123456' },
      { id: 3, type_id: 10, color: null },
      { id: 4, type_id: 20, color: null },
      { id: 5, type_id: null, color: null },
      { id: 6, type_id: null, color: null },
    ],
    [{ id: 10, palette: 'green' }, { id: 20, palette: null }],
  );
  expect(colors.get(1)).toBe(PALETTES.green.shades[0]);
  expect(colors.get(2)).toBe('#123456');
  // the own-colored category still takes a slot, so siblings keep their shades
  expect(colors.get(3)).toBe(PALETTES.green.shades[2]);
  // second type without a palette: the second palette in order
  expect(colors.get(4)).toBe(PALETTES.orange.shades[0]);
  // untyped skip the palettes the types use (green, orange): blue, amber
  expect([colors.get(5), colors.get(6)]).toEqual([UNTYPED_COLORS[0], UNTYPED_COLORS[3]]);
});

test('a type is offered only palettes no other type uses (its own stays)', () => {
  const types = [{ id: 1, palette: 'green' }, { id: 2, palette: null }, { id: 3, palette: 'blue' }];
  // type 2 has no palette of its own: the 2nd in order (orange)
  expect(freePalettes(types, 3)).toEqual(['blue', 'amber', 'pink', 'purple', 'teal', 'red']);
  expect(freePalettes(types, 2)).toEqual(['orange', 'amber', 'pink', 'purple', 'teal', 'red']);
  // every palette taken: all are offered
  const nine = PALETTE_ORDER.map((p, i) => ({ id: i, palette: p })).concat([{ id: 99, palette: 'blue' }]);
  expect(freePalettes(nine, 99)).toEqual(PALETTE_ORDER);
});

test('a category is offered its type shades and free palettes, minus colors other categories have', () => {
  const types = [{ id: 1, palette: 'green' }];
  const taken = new Set([PALETTES.green.shades[0], PALETTES.blue.shades[0]]);
  const opts = freeCategoryColors(types, 1, taken, null);
  expect(opts.slice(0, 4)).toEqual(PALETTES.green.shades.slice(1));
  expect(opts).not.toContain(PALETTES.blue.shades[0]);
  // the green type's palette is not offered to an untyped category
  expect(freeCategoryColors(types, null, new Set(), null)).not.toContain(PALETTES.green.shades[0]);
  // the current color stays even if taken
  expect(freeCategoryColors(types, 1, taken, PALETTES.blue.shades[0])).toContain(PALETTES.blue.shades[0]);
});

test('hex <-> HSL round trip; colors from a hue', () => {
  const { hexToHsl, hslToHex, colorFromHue } = require('../src/colors');
  for (const hex of ['#2a78d6', '#eb6834', '#1baf7a', '#000000', '#ffffff']) {
    const [h, s, l] = hexToHsl(hex);
    expect(hslToHex(h, s, l)).toBe(hex);
  }
  expect(Math.round(hexToHsl(colorFromHue(200))[0])).toBeGreaterThanOrEqual(199);
});

test('a custom palette: five shades of its base, used for its type\'s categories', () => {
  const { shadesFromBase, paletteShades, typePalette, hexToHsl } = require('../src/colors');
  const shades = shadesFromBase('#3a7bd5');
  expect(shades).toHaveLength(5);
  expect(new Set(shades).size).toBe(5);
  // same hue, different lightness
  for (const s of shades) expect(Math.abs(hexToHsl(s)[0] - hexToHsl('#3a7bd5')[0])).toBeLessThan(3);
  expect(typePalette({ palette: '#3a7bd5' }, 0)).toBe('#3a7bd5');
  expect(paletteShades('#3a7bd5')).toEqual(shades);
  const colors = buildCategoryColors([{ id: 1, type_id: 9, color: null }, { id: 2, type_id: 9, color: null }], [{ id: 9, palette: '#3a7bd5' }]);
  expect([colors.get(1), colors.get(2)]).toEqual(shades.slice(0, 2));
});

test('a random hue: anywhere on the wheel, not on a color in use, away from the current one', () => {
  const { distinctHue, colorFromHue, hexToHsl } = require('../src/colors');
  const gap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  // a crowded wheel: a color every 30° still leaves every part of it reachable
  const taken = Array.from({ length: 12 }, (_, i) => colorFromHue(i * 30));
  const hues = new Set<number>();
  let current: string | null = null;
  for (let i = 0; i < 200; i++) {
    const h: number = distinctHue(taken, current);
    for (let t = 0; t < 360; t += 30) expect(gap(h, t)).toBeGreaterThanOrEqual(8);
    if (current) expect(gap(h, hexToHsl(current)[0])).toBeGreaterThanOrEqual(40);
    hues.add(Math.floor(h / 60));
    current = colorFromHue(h);
  }
  // spread over the whole wheel, not one neighbourhood
  expect(hues.size).toBe(6);
});

test('many untyped categories: no repeated colors (other shades after the base ones)', () => {
  const cats = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, type_id: null, color: null }));
  const colors = buildCategoryColors(cats, [{ id: 1, palette: 'blue' }]);
  expect(new Set(colors.values()).size).toBe(20);
  expect([...colors.values()]).not.toContain(PALETTES.blue.shades[0]);
});
