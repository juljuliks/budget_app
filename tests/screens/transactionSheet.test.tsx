// 2.7: an operation's card — what it shows, its category (this one or the merchant's), the amount, the note, deleting.
import { fireEvent, waitFor } from '@testing-library/react-native';
import { openApp, screen, tap, texts, back, longPress, rowOf } from './app';
import { at, buy, ops } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { createCategory } from '../../src/db/categories';
import { getTransferTypeId } from '../../src/db/categoryTypes';

const opsOf = async (merchant: string) => (await (await getDb()).all<{ c: string | null; s: string | null; a: number; cur: string; note: string | null }>(
  `SELECT c.name AS c, t.category_source AS s, t.amount_minor AS a, t.currency AS cur, t.note FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id WHERE t.raw_merchant = ? ORDER BY t.occurred_at DESC`, [merchant]));
const ruleOf = async (merchant: string) => (await (await getDb()).get<{ name: string }>(
  'SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.pattern = ?', [merchant]))?.name ?? null;

beforeEach(() => openApp(ops));

test('2.7.1: the card — the amount, the merchant as a link, the date, the category, the SMS, the note', async () => {
  await tap('SPAR');
  expect(await screen.findByLabelText('Изменить сумму')).toBeTruthy();
  // a page over the list: the list's rows are under it
  expect(screen.getByText('−30.00 ₾')).toBeTruthy();
  expect(screen.getByText('SPAR ›')).toBeTruthy();
  expect(screen.getByText(/^Сегодня, \d\d:\d\d$/)).toBeTruthy();
  expect(screen.getByText('Сменить')).toBeTruthy();
  expect(screen.getByText('Категория мерчанта «SPAR»: 🛒 Продукты. Новые операции мерчанта получают её автоматически.')).toBeTruthy();
  expect(screen.getByText('SMS')).toBeTruthy();
  expect(screen.getByText('SPAR 30')).toBeTruthy();
  expect(screen.getByText('＋ Добавить описание')).toBeTruthy();
  expect(screen.getByText('Удалить операцию')).toBeTruthy();
});

test('2.7.2–2.7.3: without a category — "Сменить", search, the merchant without one gets it, no question', async () => {
  await tap('GLOVO');
  expect(await screen.findByText('⚪️ Без категории')).toBeTruthy();
  await tap('Сменить');
  fireEvent.changeText(await screen.findByPlaceholderText('Найти категорию'), 'кафе');
  await tap('☕️ Кафе и рестораны');
  expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена')).toBeTruthy();
  await waitFor(async () => expect((await opsOf('GLOVO'))[0]).toMatchObject({ c: 'Кафе и рестораны', s: 'rule' }));
  expect(await ruleOf('GLOVO')).toBe('Кафе и рестораны');
});

test('2.7.3a: the category\'s name a link (as the merchant\'s) opens its sheet over the card, "Сменить" on the right picks another', async () => {
  await openApp(ops);
  await tap('SPAR');
  // "Сменить" right of the "Категория" title
  await screen.findByText('Сменить');
  const all = texts();
  expect(all.slice(all.lastIndexOf('Категория'), all.lastIndexOf('Категория') + 2)).toEqual(['Категория', 'Сменить']);
  expect(screen.queryByText('Разделить по категориям')).toBeNull();
  await tap('🛒 Продукты ›');
  expect(await screen.findByDisplayValue('Продукты')).toBeTruthy();
  expect(screen.queryByText('Регулярные платежи')).toBeNull();
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
  await createCategory('Маме', '👩', await getTransferTypeId());
  await tap('Перевод · NINO B');
  expect(await screen.findByText('⚪️ Без категории')).toBeTruthy();
  await tap('Сменить');
  expect(await screen.findByText('👩 Маме')).toBeTruthy();
  const all = texts();
  // the transfer section first; "Пополнение счёта" is for deposits only
  expect(all.indexOf('Переводы')).toBeLessThan(all.indexOf('👩 Маме'));
  expect(all.indexOf('👩 Маме')).toBeLessThan(all.indexOf('🛒 Продукты'));
  expect(all).not.toContain('💳 Пополнение счёта');
  // the person isn't a merchant: no link
  expect(screen.queryByText('Перевод · NINO B ›')).toBeNull();
});

test('2.7.8: a deposit: in "Пополнение счёта", first; then the transfer categories (a person paying back)', async () => {
  await createCategory('Маме', '👩', await getTransferTypeId());
  await tap('Пополнение · SALARY');
  expect(await screen.findByText('Сменить')).toBeTruthy();
  expect(screen.getByText('💳 Пополнение счёта ›')).toBeTruthy();
  await tap('Сменить');
  expect(await screen.findByText('💳 Пополнение счёта')).toBeTruthy();
  const all = texts();
  expect(all.indexOf('💳 Пополнение счёта')).toBeLessThan(all.indexOf('👩 Маме'));
  expect(all.indexOf('Переводы')).toBeLessThan(all.indexOf('👩 Маме'));
  await tap('👩 Маме');
  await waitFor(async () => expect((await opsOf('SALARY'))[0].c).toBe('Маме'));
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
  await tap('＋ Добавить описание');
  fireEvent.changeText(await screen.findByPlaceholderText('Например, подарок маме'), 'к празднику');
  await tap('Сохранить');
  expect(await screen.findByText('Описание сохранено')).toBeTruthy();
  expect(await screen.findByText('к празднику')).toBeTruthy();
  expect((await opsOf('SPAR'))[0].note).toBe('к празднику');
  await tap('Изменить описание');
  fireEvent.changeText(screen.getByDisplayValue('к празднику'), '');
  await tap('Сохранить');
  expect(await screen.findByText('Описание удалено')).toBeTruthy();
  expect((await opsOf('SPAR'))[0].note).toBeNull();
});

test('2.7.11: the merchant\'s name opens its page over the operation\'s; its operations, "Назад" — the pages again', async () => {
  await tap('SPAR');
  await tap('SPAR ›');
  expect(await screen.findByText('Удалить мерчанта')).toBeTruthy();
  await tap(/^\d+ операци.* ›$/);
  expect(await screen.findByDisplayValue('SPAR')).toBeTruthy();
  expect(screen.queryByText('Удалить мерчанта')).toBeNull();
  await tap('Назад');
  expect(await screen.findByText('Удалить мерчанта')).toBeTruthy();
  expect(screen.queryByDisplayValue('SPAR')).toBeNull();
  // under the merchant's page — the operation's
  back();
  expect(await screen.findByText('Удалить операцию')).toBeTruthy();
});

test('2.7.12: deleting the operation; "Отменить" brings it back as it was', async () => {
  const before = await (await getDb()).all("SELECT * FROM transactions WHERE raw_merchant = 'SPAR'");
  await tap('SPAR');
  await tap('Удалить операцию');
  expect(await screen.findByText('Удалить операцию?')).toBeTruthy();
  expect(screen.getByText('SPAR, −30.00 ₾')).toBeTruthy();
  await tap('Удалить');
  expect(await screen.findByText('Операция удалена')).toBeTruthy();
  expect(await opsOf('SPAR')).toEqual([]);
  // 10 seconds for it, running out at the bottom of the toast
  expect(screen.getByTestId('toast-time-left', { includeHiddenElements: true })).toBeTruthy();
  await tap('Отменить');
  expect(await screen.findByText('Операция восстановлена')).toBeTruthy();
  expect(await (await getDb()).all("SELECT * FROM transactions WHERE raw_merchant = 'SPAR'")).toEqual(before);
});

test('2.7.14: a manual operation: no SMS', async () => {
  const db = await getDb();
  await db.run("UPDATE transactions SET raw_sms = '' WHERE raw_merchant = 'WOLT'");
  await tap('WOLT');
  expect(await screen.findByText('Описание')).toBeTruthy();
  expect(screen.queryByText('SMS')).toBeNull();
});

/** GLOVO of different categories: Кафе and Продукты on its list */
async function mixedGlovo() {
  const db = await getDb();
  await db.run("INSERT INTO mixed_merchants (merchant_key, created_at) VALUES ('GLOVO', 0)");
  await db.run("INSERT INTO merchant_categories (merchant_key, category_id) SELECT 'GLOVO', id FROM categories WHERE name IN ('Кафе и рестораны', 'Продукты')");
}
const mixedOf = async (m: string) => (await (await getDb()).all<{ name: string }>(
  'SELECT c.name FROM merchant_categories mc JOIN categories c ON c.id = mc.category_id WHERE mc.merchant_key = ? ORDER BY c.name', [m])).map((r) => r.name);

test('2.7.6: a merchant of different categories: its categories to tap, no question; another one joins its list', async () => {
  await mixedGlovo();
  await tap('GLOVO');
  expect(await screen.findByText('У «GLOVO» разные категории: каждая новая операция спрашивает.')).toBeTruthy();
  await tap('☕️ Кафе и рестораны');
  expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена')).toBeTruthy();
  expect((await opsOf('GLOVO')).map((o) => [o.c, o.s])).toEqual([['Кафе и рестораны', 'user']]);
  expect(await ruleOf('GLOVO')).toBeNull();
  // the page stays open; one chip does not add a button
  expect(screen.queryByText('Готово')).toBeNull();
  expect(screen.queryByText('Разделить')).toBeNull();
  await tap('Сменить');
  await tap('👕 Одежда');
  expect(await screen.findByText('Категория «👕 Одежда» назначена')).toBeTruthy();
  expect(await mixedOf('GLOVO')).toEqual(['Кафе и рестораны', 'Одежда', 'Продукты']);
});

test('2.7.6: a refund of such a merchant offers its categories; the pick stays this refund\'s', async () => {
  await mixedGlovo();
  await buy('GLOVO', 4, at(0, 10), null, { kind: 'refund' });
  // the list was already open: search reloads it and brings the refund in
  fireEvent.changeText(screen.getByPlaceholderText('Поиск: мерчант, описание, сумма…'), 'GLOVO');
  await tap('Возврат · GLOVO');
  expect(await screen.findByText('У «GLOVO» разные категории: каждая новая операция спрашивает.')).toBeTruthy();
  expect(screen.getByText('☕️ Кафе и рестораны')).toBeTruthy();
  expect(screen.getByText('🛒 Продукты')).toBeTruthy();
  await tap('☕️ Кафе и рестораны');
  expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена')).toBeTruthy();
  expect((await opsOf('GLOVO'))[0]).toMatchObject({ c: 'Кафе и рестораны', s: 'user' });
  expect(await ruleOf('GLOVO')).toBeNull();
});

test('2.7.6: two chips add "Разделить"; one does not', async () => {
  await mixedGlovo();
  await tap('GLOVO');
  expect(await screen.findByText('☕️ Кафе и рестораны')).toBeTruthy();
  expect(screen.queryByText('Разделить')).toBeNull();
  await tap('☕️ Кафе и рестораны');
  expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена')).toBeTruthy();
  expect(screen.queryByText('Разделить')).toBeNull();
  expect(rowOf('☕️ Кафе и рестораны').props.accessibilityState).toMatchObject({ selected: true });
  await tap('🛒 Продукты');
  expect(await screen.findByText('Разделить')).toBeTruthy();
  await tap('🛒 Продукты');
  expect(screen.queryByText('Разделить')).toBeNull();
  await tap('🛒 Продукты');
  expect(await screen.findByText('Разделить')).toBeTruthy();
  expect(rowOf('🛒 Продукты').props.accessibilityState).toMatchObject({ selected: true });
  expect(rowOf('☕️ Кафе и рестораны').props.accessibilityState).toMatchObject({ selected: true });
  await tap('Разделить');
  expect(await screen.findByText('Разделить по категориям')).toBeTruthy();
  expect(screen.getByText('остальное')).toBeTruthy();
  expect(screen.getByLabelText('Категория: ☕️ Кафе и рестораны')).toBeTruthy();
  expect(screen.getByLabelText('Сумма: 🛒 Продукты')).toBeTruthy();
});

describe('2.7.16 split between categories', () => {
  test('"Разделить по категориям": a long press picks several; the own category gets the rest; saved — the card shows the parts; "Убрать разделение" asks, "Отменить" puts them back', async () => {
    await tap('SPAR');
    await tap('Сменить');
    await longPress('👕 Одежда');
    await tap('Отмена');
    expect(await screen.findByText('Несколько категорий можно выбрать зажатием.')).toBeTruthy();
    await longPress('👕 Одежда');
    await tap('🛒 Продукты');
    await tap('Готово');
    expect(await screen.findByText('остальное')).toBeTruthy();
    await tap('+ Ещё категория');
    expect(await screen.findByText('Выбрано: 2')).toBeTruthy();
    await tap('Готово');
    fireEvent.changeText(await screen.findByLabelText('Сумма: 👕 Одежда'), '42');
    expect(await screen.findByText('Части больше суммы операции на 12.00\u00a0₾')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Сумма: 👕 Одежда'), '12');
    expect(await screen.findByText('18.00\u00a0₾')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('Разделена · 2 категории')).toBeTruthy();
    expect(texts().slice(texts().indexOf('Разделена · 2 категории'))).toEqual(expect.arrayContaining(['🛒 Продукты ›', '60%', '18.00 ₾', '👕 Одежда ›', '40%', '12.00 ₾']));
    const parts = () => (getDb()).then((db) => db.all('SELECT amount_minor FROM transaction_parts'));
    expect(await parts()).toEqual([{ amount_minor: 1200 }]);
    await tap('Убрать разделение');
    expect(await screen.findByText('Убрать разделение?')).toBeTruthy();
    expect(screen.getByText('Вся сумма вернётся в «🛒 Продукты».')).toBeTruthy();
    await tap('Убрать');
    await waitFor(async () => expect(await parts()).toEqual([]));
    expect(await screen.findByText('Сменить')).toBeTruthy();
    expect(screen.getByText('Разделение убрано')).toBeTruthy();
    await tap('Отменить');
    await waitFor(async () => expect(await parts()).toEqual([{ amount_minor: 1200 }]));
    expect(await screen.findByText('Разделена · 2 категории')).toBeTruthy();
  });
});

describe('2.7.17 the type of money that came in', () => {
  const kindOf = async (merchant: string) => (await getDb()).get<{ kind: string; c: string | null }>(
    'SELECT t.kind, c.name AS c FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.raw_merchant = ?', [merchant]);

  test('a deposit made a refund: "Тип операции" (one choice), out of "Пополнение счёта", the categories, "Разделить по категориям"', async () => {
    await tap('Пополнение · SALARY');
    await tap('Сменить тип');
    expect(await screen.findByText('Тип операции')).toBeTruthy();
    expect(screen.getByText('Доход месяца, в «Пополнении счёта»')).toBeTruthy();
    await tap('Возврат');
    expect(await screen.findByText('Теперь это возврат')).toBeTruthy();
    expect(await kindOf('SALARY')).toEqual({ kind: 'refund', c: null });
    expect(await screen.findByText('⚪️ Без категории')).toBeTruthy();
    expect(screen.getByText('Сменить')).toBeTruthy();
    expect(screen.queryByText('Разделить по категориям')).toBeNull();
  });

  test('a refund is split; made a deposit — whole, in "Пополнение счёта"', async () => {
    await tap('Возврат · ZARA');
    await tap('Сменить');
    await longPress('🛒 Продукты');
    await tap('👕 Одежда');
    await tap('Готово');
    fireEvent.changeText(await screen.findByLabelText('Сумма: 🛒 Продукты'), '2');
    await tap('Сохранить');
    expect(await screen.findByText('Разделена · 2 категории')).toBeTruthy();
    await tap('Сменить тип');
    await tap('Пополнение');
    expect(await screen.findByText('Теперь это пополнение')).toBeTruthy();
    expect(await kindOf('ZARA')).toEqual({ kind: 'deposit', c: 'Пополнение счёта' });
    expect(await (await getDb()).all('SELECT * FROM transaction_parts')).toEqual([]);
  });

  test('a purchase has no "Сменить тип"', async () => {
    await tap('SPAR');
    await screen.findByText('Сменить');
    expect(screen.queryByLabelText('Сменить тип')).toBeNull();
  });
});
