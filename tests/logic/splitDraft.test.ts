// "Разделить по категориям" being edited (features/transaction-edit/model/splitDraft.ts) and a split row's look
// (entities/transaction/model/parts.ts).
import {
  draftParts, splitDraftOf, splitState, withNewPart, withOwn, withPartCategory,
} from '../../src/features/transaction-edit/model/splitDraft';
import { partsLabel, splitRow } from '../../src/entities/transaction/model/parts';

test('the own category takes what the parts leave; saved only with every amount typed and something left', () => {
  const d = withNewPart(splitDraftOf(1, []), 2);
  expect(splitState(8640, 'GEL', d)).toMatchObject({ rest: 8640, canSave: false });
  const typed = { ...d, parts: [{ category_id: 2, text: '22' }] };
  const s = splitState(8640, 'GEL', typed);
  expect(s).toMatchObject({ rest: 6440, error: null, canSave: true });
  expect(draftParts(typed, s)).toEqual([{ category_id: 2, amount_minor: 2200 }]);
  expect(splitState(8640, 'GEL', { ...d, parts: [{ category_id: 2, text: '91,40' }] }))
    .toMatchObject({ rest: -500, error: 'Части больше суммы операции на 5.00\u00a0₾', canSave: false });
  expect(splitState(8640, 'GEL', { ...d, parts: [{ category_id: 2, text: '86.40' }] }).error).toBe('Первой категории ничего не остаётся');
  expect(splitState(8640, 'GEL', { own: null, parts: typed.parts }).canSave).toBe(false);
});

test('picking categories: no category twice; the own one picked from the parts takes that part in', () => {
  const d = { own: 1, parts: [{ category_id: 2, text: '10' }, { category_id: 3, text: '5' }] };
  expect(withNewPart(d, 2)).toBe(d);
  expect(withPartCategory(d, 0, 3)).toBe(d);
  expect(withPartCategory(d, 0, 4).parts[0].category_id).toBe(4);
  expect(withOwn(d, 3)).toEqual({ own: 3, parts: [{ category_id: 2, text: '10' }] });
});

const row = (focus?: number[]) => ({
  amount_minor: 21430, category_id: 1, category_name: 'Продукты', category_emoji: '🛒', category_type_name: 'Жизнь',
  parts: ['2\u001f4860\u001f🏠\u001f\u001fДом', '3\u001f1260\u001f🎮\u001f\u001fРазвлечения'].join('\u001e'), focus,
});

test('a split row: its categories; filtered by some of them, only those parts\' amount', () => {
  expect(splitRow(row())).toEqual({ label: '🛒 Жизнь: Продукты + ещё 2', amount_minor: 21430, part: false });
  expect(splitRow(row([2]))).toEqual({ label: '🏠 Дом + ещё 2', amount_minor: 4860, part: true });
  expect(splitRow(row([1, 3]))).toMatchObject({ amount_minor: 21430 - 4860, part: true });
  expect(splitRow({ ...row(), parts: null })).toBeNull();
  expect(partsLabel([{ category_id: 1, amount_minor: 1, label: 'A' }, { category_id: 2, amount_minor: 1, label: 'B' }])).toBe('A + B');
});
