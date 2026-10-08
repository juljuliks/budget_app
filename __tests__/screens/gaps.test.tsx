// What the first pass left out: the warnings about the locked savings, merchants of different categories, merging
// categories planned differently, periods without spending / a plan / a rate. Today: 15 October 2026.
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { longPress, openApp, openSettings, screen, tap, toggleSwitch } from './app';
import { base, buy, category, ops, planned, on } from '../../scripts/e2e/seeds';
import { getDb } from '../../src/db';
import { setPlanAmount } from '../../src/db/plans';
import { emitTransactionsChanged } from '../../src/events';

const q = async <T,>(sql: string, p: unknown[] = []) => (await getDb()).all<T>(sql, p as never);
const ruleOf = async (m: string) => (await q<{ name: string }>('SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.pattern = ?', [m]))[0]?.name ?? null;
const mixedOf = async (m: string) => (await q<{ name: string }>(
  'SELECT c.name FROM merchant_categories mc JOIN categories c ON c.id = mc.category_id WHERE mc.merchant_key = ? ORDER BY c.name', [m])).map((r) => r.name);
const isMixed = async (m: string) => (await q('SELECT 1 FROM mixed_merchants WHERE merchant_key = ?', [m])).length === 1;
/** spend now and tell the open screens */
const spend = (lari: number, cat = 'Продукты') => act(async () => {
  const c = (await q<{ id: number }>('SELECT id FROM categories WHERE name = ?', [cat]))[0].id;
  await buy('SPAR', lari, Math.floor(Date.now() / 1000) - 60, c);
  emitTransactionsChanged();
});

describe('5.6 the warnings about the locked savings', () => {
  // budget 3 000, 300 locked: 2 700 may be spent; 2 010 spent
  beforeEach(async () => { await openApp(planned); await tap('Статистика'); await screen.findByText(/^⚠ Вне плана потрачено/); });

  test('near them: 10% of what may be spent left', async () => {
    expect(screen.queryByText(/До отложенного/)).toBeNull();
    await spend(500);
    expect(await screen.findByText(/До отложенного осталось 190 ₾ — дальше траты пойдут из сбережений/)).toBeTruthy();
  });
  test('into them', async () => {
    await spend(800);
    expect(await screen.findByText(/Траты зашли в отложенное: из сбережений ушло 110 ₾/)).toBeTruthy();
  });
  test('hidden with ✕ until something new', async () => {
    await spend(500);
    await screen.findByText(/До отложенного осталось/);
    await tap('Скрыть предупреждение');
    await waitFor(() => expect(screen.queryByText(/До отложенного/)).toBeNull());
    await spend(300);
    expect(await screen.findByText(/Траты зашли в отложенное/)).toBeTruthy();
  });
});

describe('merchants of different categories', () => {
  async function mixedGlovo() {
    await ops();
    const db = await getDb();
    await db.run("INSERT INTO mixed_merchants (merchant_key, created_at) VALUES ('GLOVO', 0)");
    await db.run("INSERT INTO merchant_categories (merchant_key, category_id) SELECT 'GLOVO', id FROM categories WHERE name IN ('Кафе и рестораны', 'Продукты')");
  }

  test('2.7.6: an operation\'s card: its categories to tap, no question; another one joins its list', async () => {
    await openApp(mixedGlovo);
    await tap('GLOVO');
    expect(await screen.findByText('У «GLOVO» разные категории: каждая новая операция спрашивает.')).toBeTruthy();
    await tap('☕️ Кафе и рестораны');
    expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена')).toBeTruthy();
    expect(await q("SELECT c.name AS c, t.category_source AS s FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.raw_merchant = 'GLOVO'"))
      .toEqual([{ c: 'Кафе и рестораны', s: 'user' }]);
    expect(await ruleOf('GLOVO')).toBeNull();
    await tap('GLOVO');
    await tap('Сменить');
    await tap('👕 Одежда');
    expect(await screen.findByText('Категория «👕 Одежда» назначена')).toBeTruthy();
    expect(await mixedOf('GLOVO')).toEqual(['Кафе и рестораны', 'Одежда', 'Продукты']);
  });

  test('2.5.12: several selected: no question about the merchant; the category joins its list', async () => {
    await openApp(mixedGlovo);
    await longPress('GLOVO');
    await tap('Категория (1)');
    await tap('👕 Одежда');
    expect(await screen.findByText('Категория «👕 Одежда» назначена: 1 операция')).toBeTruthy();
    expect(await ruleOf('GLOVO')).toBeNull();
    expect(await mixedOf('GLOVO')).toContain('Одежда');
  });

  test('3.2.6: turned off with a category: its new operations get it', async () => {
    await openApp(mixedGlovo);
    await openSettings('Мерчанты');
    await tap('GLOVO');
    expect(await screen.findByText('Категории мерчанта')).toBeTruthy();
    toggleSwitch(false);
    await tap('☕️ Кафе и рестораны');
    await tap('Сохранить');
    expect(await screen.findByText('Категория «☕️ Кафе и рестораны» для «GLOVO»')).toBeTruthy();
    expect(screen.getByText('Новые операции мерчанта будут получать её автоматически. Разные категории выключатся.')).toBeTruthy();
    await tap('Продолжить');
    expect(await screen.findByText('Категория «☕️ Кафе и рестораны» назначена мерчанту «GLOVO»')).toBeTruthy();
    expect(await isMixed('GLOVO')).toBe(false);
    expect(await ruleOf('GLOVO')).toBe('Кафе и рестораны');
  });

  test('3.2.7: turned off without one: new operations come without a category', async () => {
    await openApp(mixedGlovo);
    await openSettings('Мерчанты');
    await tap('GLOVO');
    await screen.findByText('Категории мерчанта');
    toggleSwitch(false);
    await tap('Сохранить');
    expect(await screen.findByText('Новые операции «GLOVO» будут приходить без категории')).toBeTruthy();
    expect(await isMixed('GLOVO')).toBe(false);
    expect(await ruleOf('GLOVO')).toBeNull();
  });
});

test('4.4.2: merging categories planned differently: how to plan the merged one', async () => {
  await openApp(async () => {
    await base();
    await setPlanAmount('2026-10', await category('Одежда', '👕'), 20000, 'fixed', 'GEL', 'month');
  });
  await openSettings('Категории');
  await longPress('🛍️ Покупки');
  await tap('👕 Одежда');
  await tap('Объединить (2)');
  expect(await screen.findByText('Суммы складываются: 700 ₾')).toBeTruthy();
  expect(screen.getByText('Категории запланированы по-разному — как планировать объединённую:')).toBeTruthy();
  expect(screen.getByText('Лимит · каждый день')).toBeTruthy();
  expect(screen.getByText('как «Покупки»')).toBeTruthy();
  expect(screen.getByText('как «Одежда»')).toBeTruthy();
  await tap('Обязательный платёж');
  await tap('Объединить');
  expect(await screen.findByText('Категории объединены в «Покупки & Одежда»')).toBeTruthy();
  expect(await q("SELECT p.limit_minor AS a, p.kind FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE c.name = 'Покупки & Одежда' AND p.ym = '2026-10'"))
    .toEqual([{ a: 70000, kind: 'fixed' }]);
});

describe('5.1–5.3 periods without spending, a plan, a rate', () => {
  const period = async (name: string) => { await tap('Выбрать период'); await tap(name); };

  test('a day without spending', async () => {
    await openApp();
    await tap('Статистика');
    await period('За день');
    expect(await screen.findByText('За этот период трат нет.')).toBeTruthy();
  });
  test('a whole month of one\'s own without a plan: only the structure (a day or a week puts it all "Вне плана")', async () => {
    await openApp(ops);
    await tap('Статистика');
    await period('Свой период');
    // the calendar comes up once the period list has slid away
    await screen.findByText('Показать');
    await tap('‹');
    await tap('#day-2026-09-01');
    await tap('#day-2026-09-30');
    await tap('Показать');
    expect(await screen.findByText('1 сен 2026 – 30 сен 2026')).toBeTruthy();
    expect(await screen.findByText('Плана на эти дни нет — показана только структура трат.')).toBeTruthy();
  });
  test('spending in a currency without a rate (offline): said, not counted', async () => {
    await openApp(ops);
    await tap('Статистика');
    expect(await screen.findByText('Не учтено — нет курса валюты (нужен интернет): 10.00 $')).toBeTruthy();
  });
  test('a year without a full month of data: no average', async () => {
    await openApp(async () => { await buy('SPAR', 10, on(10), null); });
    await tap('Статистика');
    await period('За год');
    expect(await screen.findByText('Для среднего в месяц нужен хотя бы один полный месяц с данными.')).toBeTruthy();
  });
  test('a month without spending', async () => {
    await openApp();
    await tap('Статистика');
    expect(await screen.findByText('В этом месяце трат нет.')).toBeTruthy();
  });
});
