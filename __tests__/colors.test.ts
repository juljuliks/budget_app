import { buildCategoryColors, PALETTES, UNTYPED_COLORS } from '../src/colors';

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
