// 2.7: an operation's card — what it shows, its category (this one or the merchant's), the amount, the note, deleting.
import { fireEvent, waitFor } from '@testing-library/react-native';
import { openApp, screen, tap, texts } from './app';
import { ops } from '../../scripts/e2e/seeds';
import { getDb } from '../../src/db';

const opsOf = async (merchant: string) => (await (await getDb()).all<{ c: string | null; s: string | null; a: number; cur: string; note: string | null }>(
  `SELECT c.name AS c, t.category_source AS s, t.amount_minor AS a, t.currency AS cur, t.note FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id WHERE t.raw_merchant = ? ORDER BY t.occurred_at DESC`, [merchant]));
const ruleOf = async (merchant: string) => (await (await getDb()).get<{ name: string }>(
  'SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.pattern = ?', [merchant]))?.name ?? null;

beforeEach(() => openApp(ops));

test('2.7.1: the card — the amount, the merchant as a link, the date, the category, the SMS, the note', async () => {
  await tap('SPAR');
  expect(await screen.findByLabelText('Изменить сумму')).toBeTruthy();
  expect(screen.getAllByText('−30.00 ₾').length).toBeGreaterThan(1);
  expect(screen.getByText('SPAR ›')).toBeTruthy();
  expect(screen.getByText(/^Сегодня, \d\d:\d\d$/)).toBeTruthy();
  expect(screen.getByText('Сменить')).toBeTruthy();
  expect(screen.getByText('Категория мерчанта «SPAR»: 🛒 Продукты. Новые операции мерчанта получают её автоматически.')).toBeTruthy();
  expect(screen.getByText('SMS')).toBeTruthy();
  expect(screen.getByText('SPAR 30')).toBeTruthy();
  expect(screen.getByText('＋ Добавить заметку')).toBeTruthy();
  expect(screen.getByText('Удалить операцию')).toBeTruthy();
});

test('2.7.2–2.7.3: without a category: the categories right away; the merchant without one gets it, no question', async () => {
  await tap('GLOVO');
  expect(await screen.findByText('Выберите категорию')).toBeTruthy();
  expect(screen.getByText('Все категории')).toBeTruthy();
  await tap('☕️ Кафе и рестораны');
  expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена')).toBeTruthy();
  await waitFor(async () => expect((await opsOf('GLOVO'))[0]).toMatchObject({ c: 'Кафе и рестораны', s: 'rule' }));
  expect(await ruleOf('GLOVO')).toBe('Кафе и рестораны');
});

describe('2.7.4: the merchant has another category', () => {
  async function pick() {
    // a purchase (a refund just takes its merchant's category): the older one of ZARA
    await tap('ZARA');
    await tap('Сменить');
    expect(await screen.findByText('Сменить категорию')).toBeTruthy();
    await tap('🛒 Продукты');
    expect(await screen.findByText('Категория «🛒 Продукты» — для этой операции или для мерчанта «ZARA»?')).toBeTruthy();
  }
  test('this operation only', async () => {
    await pick();
    await tap('Только для этой операции');
    expect(await screen.findByText('Категория «🛒 Продукты» назначена')).toBeTruthy();
    expect((await opsOf('ZARA')).map((o) => [o.c, o.s])).toEqual([['Одежда', 'rule'], ['Одежда', 'rule'], ['Продукты', 'user']]);
    expect(await ruleOf('ZARA')).toBe('Одежда');
  });
  test('the merchant', async () => {
    await pick();
    // the refund and both purchases follow the merchant: 120 + 80 − 5
    expect(screen.getByText('Сейчас у мерчанта «👕 Одежда». Для мерчанта: категория изменится у 3 операций на 195.00 ₾, и новые операции мерчанта будут получать её автоматически. Выбранные вручную категории не изменятся.')).toBeTruthy();
    await tap('Для мерчанта');
    expect(await screen.findByText('Категория «🛒 Продукты» назначена мерчанту «ZARA»')).toBeTruthy();
    expect((await opsOf('ZARA')).map((o) => o.c)).toEqual(['Продукты', 'Продукты', 'Продукты']);
    expect(await ruleOf('ZARA')).toBe('Продукты');
  });
  test('the same category as the merchant\'s: no question', async () => {
    await tap('ZARA');
    await tap('Сменить');
    await tap('👕 Одежда');
    await waitFor(() => expect(screen.queryByText(/для этой операции или для мерчанта/)).toBeNull());
  });
});

test('2.7.7: "Без категории" stays: the merchant\'s category won\'t fill it in later', async () => {
  await tap('SPAR');
  await tap('Сменить');
  await tap('⚪️ Без категории');
  expect(await screen.findByText('Категория убрана')).toBeTruthy();
  expect((await opsOf('SPAR'))[0]).toMatchObject({ c: null, s: 'user' });
});

test('2.7.8: a transfer: the transfer categories first, no merchant category', async () => {
  await tap('Перевод · NINO B');
  expect(await screen.findByText('Выберите категорию')).toBeTruthy();
  const all = texts();
  // "Без категории" first (what it has now), then the transfer ones
  const i = all.indexOf('Выберите категорию');
  expect(all.slice(i + 1, i + 3)).toEqual(['⚪️ Без категории', '🔁 Переводы: Прочие']);
  // the person isn't a merchant: no link
  expect(screen.queryByText('Перевод · NINO B ›')).toBeNull();
});

test('2.7.9: the amount and its currency', async () => {
  await tap('SPAR');
  await tap('Изменить сумму');
  expect(await screen.findByText('Сумма')).toBeTruthy();
  const input = screen.getByDisplayValue('30');
  fireEvent.changeText(input, 'abc');
  await tap('Сохранить');
  expect(await screen.findByText(/Введите сумму, например 1500 или 12\.50/)).toBeTruthy();
  fireEvent.changeText(input, '42,5');
  await tap('Сохранить');
  expect(await screen.findByText('Сумма изменена')).toBeTruthy();
  await waitFor(async () => expect((await opsOf('SPAR'))[0]).toMatchObject({ a: 4250, cur: 'GEL' }));
});

test('2.7.10: a note — added, shown, found, removed', async () => {
  await tap('SPAR');
  await tap('＋ Добавить заметку');
  fireEvent.changeText(await screen.findByPlaceholderText('Например, подарок маме'), 'к празднику');
  await tap('Сохранить');
  expect(await screen.findByText('Заметка сохранена')).toBeTruthy();
  expect(await screen.findByText('к празднику')).toBeTruthy();
  expect((await opsOf('SPAR'))[0].note).toBe('к празднику');
  await tap('Изменить заметку');
  fireEvent.changeText(screen.getByDisplayValue('к празднику'), '');
  await tap('Сохранить');
  expect(await screen.findByText('Заметка удалена')).toBeTruthy();
  expect((await opsOf('SPAR'))[0].note).toBeNull();
});

test('2.7.11: the merchant\'s name opens its card', async () => {
  await tap('SPAR');
  await tap('SPAR ›');
  expect(await screen.findByText('Разные категории')).toBeTruthy();
  expect(screen.getByText('Показать операции ›')).toBeTruthy();
});

test('2.7.12: deleting the operation', async () => {
  await tap('SPAR');
  await tap('Удалить операцию');
  expect(await screen.findByText('Удалить операцию?')).toBeTruthy();
  expect(screen.getByText('SPAR, −30.00 ₾')).toBeTruthy();
  await tap('Удалить');
  expect(await screen.findByText('Операция удалена')).toBeTruthy();
  expect(await opsOf('SPAR')).toEqual([]);
});

test('2.7.14: a manual operation: no SMS', async () => {
  const db = await getDb();
  await db.run("UPDATE transactions SET raw_sms = '' WHERE raw_merchant = 'WOLT'");
  await tap('WOLT');
  expect(await screen.findByText('Заметка')).toBeTruthy();
  expect(screen.queryByText('SMS')).toBeNull();
});
