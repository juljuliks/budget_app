// 2.5–2.6: selecting several operations (and what is done to them), the edit mode.
import { fireEvent, waitFor } from '@testing-library/react-native';
import { longPress, openApp, screen, scrollTo, tap } from './app';
import { ops } from '../../scripts/e2e/seeds';
import { getDb } from '../../src/db';
import { dayKey } from '../../src/ui/format';

const db = async () => getDb();
/** a merchant's operations: [category name, source], newest first */
const opsOf = async (merchant: string) => (await (await db()).all<{ c: string | null; s: string | null }>(
  `SELECT c.name AS c, t.category_source AS s FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.raw_merchant = ? ORDER BY t.occurred_at DESC`, [merchant])).map((r) => [r.c, r.s]);
const ruleOf = async (merchant: string) => (await (await db()).get<{ name: string }>(
  "SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.pattern = ?", [merchant]))?.name ?? null;

beforeEach(() => openApp(ops));

test('2.5.1–2.5.5: a long press starts selecting; taps toggle; the last one off ends it; all; cancel', async () => {
  await screen.findByText('SPAR');
  await longPress('SPAR');
  expect(await screen.findByText('Выбрано: 1')).toBeTruthy();
  expect(screen.getByText('Выбрать все')).toBeTruthy();
  // the actions instead of "+"
  expect(screen.queryByLabelText('Добавить операцию')).toBeNull();
  expect(screen.getByText('Категория (1)')).toBeTruthy();
  expect(screen.getByText('Удалить (1)')).toBeTruthy();
  await tap('WOLT');
  expect(await screen.findByText('Выбрано: 2')).toBeTruthy();
  await tap('WOLT');
  await tap('SPAR');
  await waitFor(() => expect(screen.queryByText(/^Выбрано: /)).toBeNull());
  expect(screen.getByLabelText('Добавить операцию')).toBeTruthy();
  // all that's loaded (the first page), then none
  await longPress('SPAR');
  await tap('Выбрать все');
  expect(await screen.findByText('Выбрано: 50')).toBeTruthy();
  await tap('Выбрать все');
  expect(await screen.findByText('Выбрано: 0')).toBeTruthy();
  await tap('Отмена');
  await waitFor(() => expect(screen.queryByText(/^Выбрано: /)).toBeNull());
});

test('2.5.7: a day\'s checkbox: all of its operations; none on a day of one', async () => {
  await screen.findByText('SPAR');
  await longPress('SPAR');
  const today = dayKey(Date.now() / 1000);
  await tap(`#day-checkbox-${today}`);
  // the 5 of today (SPAR was one of them)
  expect(await screen.findByText('Выбрано: 5')).toBeTruthy();
  await tap(`#day-checkbox-${today}`);
  await waitFor(() => expect(screen.queryByText(/^Выбрано: /)).toBeNull());
});

test('2.5.6: a group\'s checkbox picks its operations not loaded yet too; none for a group of one', async () => {
  await tap('#filter-group');
  await tap('По мерчантам');
  await screen.findByText('MARKET · 60 операций');
  await longPress('MARKET');
  await tap('#group-checkbox-MARKET');
  // all 60 though only the first page (50 rows) is loaded
  expect(await screen.findByText('Выбрано: 60')).toBeTruthy();
  await scrollTo('operations-list', 'SPAR · 1 операция');
  expect(screen.queryByTestId('group-checkbox-SPAR')).toBeNull();
});

test('2.5.8: "Отметить просмотренными" for the unread ones among the selected', async () => {
  await screen.findByText('SPAR');
  await longPress('SPAR');
  await tap('Перевод · NINO B');
  await tap('GLOVO');
  await tap('Отметить просмотренными (2)');
  await waitFor(async () => expect((await (await db()).get<{ n: number }>('SELECT count(*) AS n FROM transactions WHERE seen_at IS NULL'))!.n).toBe(0));
});

test('2.5.9: a category for the selected; merchants without one get it, no question', async () => {
  await screen.findByText('GLOVO');
  await longPress('GLOVO');
  await tap('Перевод · NINO B');
  await tap('Категория (2)');
  expect(await screen.findByText('Выбрано операций: 2')).toBeTruthy();
  await tap('☕️ Кафе и рестораны');
  expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена: 2 операции и 1 мерчанту')).toBeTruthy();
  expect(await opsOf('GLOVO')).toEqual([['Кафе и рестораны', 'rule']]);
  expect(await ruleOf('GLOVO')).toBe('Кафе и рестораны');
  // a transfer: the person gets no category
  expect(await opsOf('NINO B')).toEqual([['Кафе и рестораны', 'user']]);
  expect(await ruleOf('NINO B')).toBeNull();
});

describe('2.5.10: the merchant has another category: the selected only, or the merchant too', () => {
  async function pick() {
    await tap('#filter-group');
    await tap('По мерчантам');
    await scrollTo('operations-list', 'ZARA · 3 операции');
    await longPress('−120.00 ₾');
    await tap('Категория (1)');
    await tap('🛒 Продукты');
    expect(await screen.findByText('Категория «🛒 Продукты» — только для выбранных операций или и для мерчанта?')).toBeTruthy();
    // the two purchases and the refund of ZARA follow it: 120 + 80 − 5
    expect(screen.getByText('Для мерчанта «ZARA»: категория изменится у 3 операций на 195.00 ₾, и новые операции будут получать её автоматически. Выбранные вручную категории не изменятся.')).toBeTruthy();
  }
  test('only the selected', async () => {
    await pick();
    await tap('Только для выбранных (1)');
    await waitFor(async () => expect(await opsOf('ZARA')).toEqual([['Одежда', 'rule'], ['Продукты', 'user'], ['Одежда', 'rule']]));
    expect(await ruleOf('ZARA')).toBe('Одежда');
  });
  test('the merchant too', async () => {
    await pick();
    await tap('И для мерчанта');
    await waitFor(async () => expect((await opsOf('ZARA')).map((o) => o[0])).toEqual(['Продукты', 'Продукты', 'Продукты']));
    expect(await ruleOf('ZARA')).toBe('Продукты');
    expect(await screen.findByText('Категория «🛒 Продукты» назначена: 1 операция и 1 мерчанту')).toBeTruthy();
  });
});

test('2.5.11: "Без категории" for the selected', async () => {
  await screen.findByText('SPAR');
  await longPress('SPAR');
  await tap('Категория (1)');
  await tap('⚪️ Без категории');
  expect(await screen.findByText('Категория убрана: 1 операция')).toBeTruthy();
  expect(await opsOf('SPAR')).toEqual([[null, 'user']]);
});

test('2.5.14: deleting the selected, after asking', async () => {
  await screen.findByText('SPAR');
  await longPress('SPAR');
  await tap('WOLT');
  await tap('Удалить (2)');
  expect(await screen.findByText('Удалить 2 операции?')).toBeTruthy();
  expect(screen.getByText('Они пропадут из истории и статистики. Отменить это нельзя.')).toBeTruthy();
  await tap('Удалить (2)');
  expect(await screen.findByText('Удалено операций: 2')).toBeTruthy();
  expect(await opsOf('SPAR')).toEqual([]);
  expect(await opsOf('WOLT')).toEqual([]);
});

test('2.5.15: a new filter ends the selection', async () => {
  await screen.findByText('SPAR');
  await longPress('SPAR');
  await tap('#filter-kind');
  await tap('Возврат');
  await tap('Готово');
  await waitFor(() => expect(screen.queryByText(/^Выбрано: /)).toBeNull());
});

test('2.6: the edit mode — a 🗑 on every row, no "+", "Готово" leaves it', async () => {
  await screen.findByText('SPAR');
  await tap('Редактировать');
  expect(await screen.findByText('Готово')).toBeTruthy();
  expect(screen.queryByLabelText('Добавить операцию')).toBeNull();
  // the first row's 🗑: SPAR
  fireEvent.press(screen.getAllByLabelText('Удалить')[0]);
  expect(await screen.findByText('Удалить операцию?')).toBeTruthy();
  expect(screen.getByText('SPAR, −30.00 ₾')).toBeTruthy();
  await tap('Удалить');
  expect(await screen.findByText('Операция удалена')).toBeTruthy();
  expect(await opsOf('SPAR')).toEqual([]);
  await tap('Готово');
  expect(await screen.findByText('Редактировать')).toBeTruthy();
  expect(screen.getByLabelText('Добавить операцию')).toBeTruthy();
});

/** GLOVO of different categories: Кафе and Продукты on its list */
async function mixedGlovo() {
  const db = await getDb();
  await db.run("INSERT INTO mixed_merchants (merchant_key, created_at) VALUES ('GLOVO', 0)");
  await db.run("INSERT INTO merchant_categories (merchant_key, category_id) SELECT 'GLOVO', id FROM categories WHERE name IN ('Кафе и рестораны', 'Продукты')");
}
const mixedOf = async (m: string) => (await (await getDb()).all<{ name: string }>(
  'SELECT c.name FROM merchant_categories mc JOIN categories c ON c.id = mc.category_id WHERE mc.merchant_key = ? ORDER BY c.name', [m])).map((r) => r.name);

test('2.5.12: a merchant of different categories among the selected: no question; the category joins its list', async () => {
  await mixedGlovo();
  await longPress('GLOVO');
  await tap('Категория (1)');
  await tap('👕 Одежда');
  expect(await screen.findByText('Категория «👕 Одежда» назначена: 1 операция')).toBeTruthy();
  expect(await ruleOf('GLOVO')).toBeNull();
  expect(await mixedOf('GLOVO')).toContain('Одежда');
});
