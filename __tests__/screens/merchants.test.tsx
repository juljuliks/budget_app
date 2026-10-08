// 3: the merchants — the list by category, a merchant's card (its category, "Разные категории", deleting), several at once.
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { longPress, openApp, openSettings, rowOf, screen, tap, toggleSwitch } from './app';
import { ops } from '../../scripts/e2e/seeds';
import { getDb } from '../../src/db';

const q = async <T,>(sql: string, p: unknown[] = []) => (await getDb()).all<T>(sql, p as never);
const ruleOf = async (m: string) => (await q<{ name: string }>('SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.pattern = ?', [m]))[0]?.name ?? null;
const opsOf = async (m: string) => (await q<{ c: string | null; s: string | null }>(
  'SELECT c.name AS c, t.category_source AS s FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.merchant_key = ? ORDER BY t.occurred_at DESC', [m])).map((r) => [r.c, r.s]);

beforeEach(async () => {
  await openApp(ops);
  await openSettings('Мерчанты');
  await screen.findByPlaceholderText('Найти мерчанта');
});

describe('3.1 the list', () => {
  test('by category, "Без категории" first; each with its last month', async () => {
    expect(await screen.findByText('⚪️ Без категории · 3 мерчанта')).toBeTruthy();
    expect(screen.getByText('🛒 Продукты · 2 мерчанта')).toBeTruthy();
    expect(screen.getByText('👕 Одежда · 1 мерчант')).toBeTruthy();
    expect(within(rowOf('SPAR')).getByText('За последний месяц: 1 покупка на 30.00 ₾')).toBeTruthy();
    // purchases only: ZARA's refund isn't one
    expect(within(rowOf('ZARA')).getByText('За последний месяц: 2 покупки на 200.00 ₾')).toBeTruthy();
    expect(within(rowOf('NETFLIX.COM')).getByText('За последний месяц: 1 покупка на 10.00 $')).toBeTruthy();
    // a transfer's person isn't a merchant here
    expect(screen.queryByText('NINO B')).toBeNull();
  });
  test('the long unvisited ones wait collapsed at the bottom', async () => {
    expect(await screen.findByText('Давно не было покупок · 1 мерчант')).toBeTruthy();
    expect(screen.queryByText('OLDSHOP')).toBeNull();
    await tap('Показать');
    expect(await screen.findByText('OLDSHOP')).toBeTruthy();
    expect(within(rowOf('OLDSHOP')).getByText(/^⚪️ Без категории · 1 покупка на 15\.00 ₾ · 15 [а-я]+ \d{4}$/)).toBeTruthy();
    await tap('Свернуть');
    await waitFor(() => expect(screen.queryByText('OLDSHOP')).toBeNull());
  });
  test('the search, the long unvisited ones too; nothing found', async () => {
    fireEvent.changeText(screen.getByPlaceholderText('Найти мерчанта'), 'old');
    expect(await screen.findByText('OLDSHOP')).toBeTruthy();
    expect(screen.queryByText('SPAR')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Найти мерчанта'), 'zzz');
    expect(await screen.findByText('Не найдено.')).toBeTruthy();
    await tap('Очистить');
    expect(await screen.findByText('SPAR')).toBeTruthy();
  });
  test('the category filter', async () => {
    await tap('Категория');
    expect(within(rowOf('⚪️ Без категории')).getByText('4')).toBeTruthy();
    await tap('👕 Одежда');
    await tap('Готово');
    await waitFor(() => expect(screen.queryByText('SPAR')).toBeNull());
    expect(screen.getByText('ZARA')).toBeTruthy();
  });
});

describe('3.2 a merchant\'s card', () => {
  test('what it shows', async () => {
    await tap('ZARA');
    // its purchases; spent there: minus the refund
    expect(await screen.findByText('2 операции · 195.00 ₾')).toBeTruthy();
    expect(screen.getByText('Показать операции ›')).toBeTruthy();
    expect(screen.getByText('Разные категории')).toBeTruthy();
    expect(screen.getByText('Каждая новая операция спрашивает категорию')).toBeTruthy();
    expect(screen.getByText('👕 Одежда')).toBeTruthy();
  });

  test('the first category: no question; the hand-picked operation keeps its own', async () => {
    await tap('WOLT');
    expect(await screen.findByText('Выберите категорию')).toBeTruthy();
    await tap('🛒 Продукты');
    await tap('Сохранить');
    expect(await screen.findByText('Категория «🛒 Продукты» назначена мерчанту «WOLT»')).toBeTruthy();
    expect(await ruleOf('WOLT')).toBe('Продукты');
    expect(await opsOf('WOLT')).toEqual([['Кафе и рестораны', 'user']]);
  });

  describe('another category, with operations that follow it', () => {
    async function change() {
      await tap('SPAR');
      await tap('Сменить');
      await tap('☕️ Кафе и рестораны');
      await tap('Сохранить');
      expect(await screen.findByText('Категория «☕️ Кафе и рестораны» для «SPAR»')).toBeTruthy();
      expect(screen.getByText(/^Новые операции будут получать «☕️ Кафе и рестораны»\. Выбранные вручную категории не изменятся\..*Какую категорию сделать для 1 прошлой операции на 30\.00 ₾\?$/)).toBeTruthy();
    }
    test('the past ones change too', async () => {
      await change();
      await tap('☕️ Кафе и рестораны');
      await waitFor(async () => expect(await opsOf('SPAR')).toEqual([['Кафе и рестораны', 'rule']]));
      expect(await ruleOf('SPAR')).toBe('Кафе и рестораны');
    });
    test('the past ones keep theirs (no longer following the merchant)', async () => {
      await change();
      await tap('🛒 Продукты');
      await waitFor(async () => expect(await opsOf('SPAR')).toEqual([['Продукты', 'user']]));
      expect(await ruleOf('SPAR')).toBe('Кафе и рестораны');
    });
  });

  test('without a category', async () => {
    await tap('SPAR');
    await tap('Сменить');
    await tap('⚪️ Без категории');
    await tap('Сохранить');
    expect(await screen.findByText('Без категории для «SPAR»')).toBeTruthy();
    expect(screen.getByText(/^Новые операции будут приходить без категории\. Выбранные вручную категории не изменятся\./)).toBeTruthy();
    await tap('⚪️ Без категории');
    expect(await screen.findByText('Новые операции «SPAR» будут приходить без категории')).toBeTruthy();
    expect(await ruleOf('SPAR')).toBeNull();
    expect(await opsOf('SPAR')).toEqual([[null, null]]);
  });

  test('"Разные категории": its list, then each new operation asks', async () => {
    await tap('ZARA');
    await screen.findByText('Разные категории');
    toggleSwitch(true);
    expect(await screen.findByText('Категории мерчанта')).toBeTruthy();
    expect(screen.getByText('Какие обычно категории у «ZARA»?')).toBeTruthy();
    // it starts with the categories its operations have
    expect(screen.getByText('👕 Одежда')).toBeTruthy();
    await tap('＋ Добавить категорию');
    await tap('🛍️ Покупки');
    await tap('Готово');
    await tap('Сохранить');
    expect(await screen.findByText('Разные категории у «ZARA»: «👕 Одежда», «🛍️ Покупки»')).toBeTruthy();
    expect(screen.getByText(/Категория мерчанта «👕 Одежда» открепится, у прошлых операций она останется\.$/)).toBeTruthy();
    await tap('Продолжить');
    expect(await screen.findByText('«ZARA»: разные категории')).toBeTruthy();
    expect(await ruleOf('ZARA')).toBeNull();
    expect((await q('SELECT 1 FROM mixed_merchants WHERE merchant_key = ?', ['ZARA'])).length).toBe(1);
    expect((await q<{ name: string }>('SELECT c.name FROM merchant_categories m JOIN categories c ON c.id = m.category_id WHERE m.merchant_key = ? ORDER BY c.name', ['ZARA'])).map((r) => r.name))
      .toEqual(['Одежда', 'Покупки']);
    // its operations keep their categories as their own
    expect((await opsOf('ZARA')).map((o) => o[1])).toEqual(['user', 'user', 'user']);
    // in its own section now
    expect(await screen.findByText('Разные категории · 1 мерчант')).toBeTruthy();
  });

  test('"Показать операции": the operations searched by its name; back returns here', async () => {
    await tap('SPAR');
    await tap('Показать операции ›');
    expect(await screen.findByDisplayValue('SPAR')).toBeTruthy();
    await tap('Назад');
    expect(await screen.findByPlaceholderText('Найти мерчанта')).toBeTruthy();
  });

  test('deleting it: its operations stay, without the merchant', async () => {
    await tap('ZARA');
    await tap('Удалить мерчанта');
    expect(await screen.findByText('Удалить мерчанта «ZARA»?')).toBeTruthy();
    expect(screen.getByText(/^2 покупки останутся в операциях со своими категориями, но без мерчанта\./)).toBeTruthy();
    await tap('Удалить мерчанта');
    expect(await screen.findByText('Мерчант «ZARA» удалён')).toBeTruthy();
    expect(await opsOf('ZARA')).toEqual([]);
    expect(await ruleOf('ZARA')).toBeNull();
    expect((await q<{ c: string; s: string }>("SELECT c.name AS c, t.category_source AS s FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.amount_minor IN (12000, 8000) AND t.merchant_key IS NULL")).length).toBe(2);
  });
});

describe('3.3 several merchants', () => {
  test('one category for them, after saying what changes', async () => {
    await longPress('WOLT');
    expect(await screen.findByText('Выбрано: 1')).toBeTruthy();
    await tap('GLOVO');
    await tap('Категория (2)');
    await tap('☕️ Кафе и рестораны');
    expect(await screen.findByText('Категория «☕️ Кафе и рестораны» для 2 мерчантов?')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена: 2 мерчанта')).toBeTruthy();
    expect(await ruleOf('WOLT')).toBe('Кафе и рестораны');
    expect(await ruleOf('GLOVO')).toBe('Кафе и рестораны');
    expect(await opsOf('GLOVO')).toEqual([['Кафе и рестораны', 'rule']]);
  });
  test('deleting them', async () => {
    await longPress('WOLT');
    await tap('GLOVO');
    await tap('Удалить (2)');
    expect(await screen.findByText('Удалить мерчантов (2)?')).toBeTruthy();
    await tap('Удалить (2)');
    expect(await screen.findByText('Удалено мерчантов: 2')).toBeTruthy();
    expect(await opsOf('WOLT')).toEqual([]);
  });
  test('the last one off ends the selection; "Отмена"', async () => {
    await longPress('WOLT');
    await tap('WOLT');
    await waitFor(() => expect(screen.queryByText(/^Выбрано: /)).toBeNull());
    await longPress('WOLT');
    await tap('Отмена');
    await waitFor(() => expect(screen.queryByText(/^Выбрано: /)).toBeNull());
  });
});
