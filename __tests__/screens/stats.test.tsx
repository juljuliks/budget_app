// 5: the stats — a month against its plan, a day / week against the limits, a long period, hidden amounts, the
// currency, the warning over them. Today: Thursday 15 October 2026 (setup.ts).
import { act, waitFor, within } from '@testing-library/react-native';
import { openApp, rowOf, screen, tap, texts } from './app';
import { planned } from '../../scripts/e2e/seeds';
import { getDb } from '../../src/db';
import { getSetting } from '../../src/db/settings';

async function openStats() {
  await openApp(planned);
  await tap('Статистика');
  await screen.findByText('Потрачено 2 010 / 2 460 ₾ (82%)');
}
const period = async (name: string) => { await tap('Выбрать период'); await tap(name); };
/** the block (row) of a category: its texts in order */
const block = (name: string) => { const t = texts(); const i = t.indexOf(name); return t.slice(i, i + 5); };

describe('5.1 a month', () => {
  beforeEach(openStats);

  test('the donut\'s total; the month against its whole plan (the categories\' and the share outside it)', async () => {
    expect(screen.getByText('Потрачено')).toBeTruthy();
    expect(screen.getByText('2 010 ₾')).toBeTruthy();
    expect(screen.getByText('Осталось 450 ₾ · до 31 окт')).toBeTruthy();
  });

  test('a section\'s header: fact / plan (%)', async () => {
    expect(screen.getByText('1 645 / 2 160 ₾ (76%)')).toBeTruthy();
  });

  test('the rows: limits with what\'s left and the limit per rhythm, overspends, obligatory payments', async () => {
    expect(block('🛒 Продукты')).toEqual(['🛒 Продукты', '305 / 620 ₾ (49%)', 'осталось 315 ₾ · лимит ≈ 20 ₾ в день', 'Сегодня перерасход 5 ₾', '☕️ Кафе и рестораны']);
    // the week's limit rebalanced on what's left of the month: (310 − 40) / 20 days × 7
    expect(block('☕️ Кафе и рестораны').slice(1, 4)).toEqual(['90 / 310 ₾ (29%)', 'осталось 220 ₾ · 70 ₾ → 94.50 ₾ в неделю', 'На этой неделе осталось 44.50 ₾ · до вс']);
    expect(block('👕 Одежда').slice(1, 3)).toEqual(['450 / 400 ₾ (113%)', 'Перерасход 50 ₾']);
    expect(block('🏠 Дом и коммуналка').slice(1, 3)).toEqual(['✓', '800 / 800 ₾ (100%)']);
    expect(block('📺 Подписки').slice(1, 3)).toEqual(['○', '0 / 30 ₾']);
  });

  test('outside the plan: the categories without one and the uncategorized, against the share', async () => {
    expect(block('Вне плана').slice(1, 3)).toEqual(['380 / 300 ₾ (127%)', 'Перерасход 80 ₾']);
    expect(within(rowOf('🎮 Развлечения')).getByText('＋ В план')).toBeTruthy();
    expect(within(rowOf('🎮 Развлечения')).getByText('300 ₾')).toBeTruthy();
    expect(within(rowOf('⚪️ Без категории')).queryByText('＋ В план')).toBeNull();
    expect(screen.getByText('+15 ₾')).toBeTruthy();
  });

  test('a category opens its operations of the month; back returns', async () => {
    await tap('👕 Одежда');
    expect(await screen.findByText('Категория · 1')).toBeTruthy();
    expect(screen.getByText('ZARA')).toBeTruthy();
    expect(screen.queryByText('SPAR')).toBeNull();
    await tap('Назад');
    expect(await screen.findByText('Потрачено 2 010 / 2 460 ₾ (82%)')).toBeTruthy();
  });

  test('the refunds without a category open as such', async () => {
    await tap('↩ Возвраты без категории');
    expect(await screen.findByText('Возврат · IKEA')).toBeTruthy();
    expect(screen.queryByText('Перевод · NINO B')).toBeNull();
  });

  test('"＋ В план" offers what it spent; saved, it is in the plan', async () => {
    await tap(within(rowOf('🚕 Такси')).getByText('＋ В план'));
    expect(await screen.findByDisplayValue('60')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('План «🚕 Такси» сохранён')).toBeTruthy();
    expect(await screen.findByText('60 / 60 ₾ (100%)')).toBeTruthy();
  });

  test('the previous month: its numbers, its report row; no going past this month', async () => {
    expect(screen.getByLabelText('Следующий месяц').props.accessibilityState?.disabled ?? true).toBeTruthy();
    await tap('Предыдущий месяц');
    expect(await screen.findByText('Сентябрь 2026')).toBeTruthy();
    expect(await screen.findByText('Отложено 1 150 ₾ · могли ещё 250 ₾')).toBeTruthy();
    expect(screen.getByText('Потрачено 1 850 / 1 700 ₾ (109%)')).toBeTruthy();
    expect(screen.getByText('Перерасход 150 ₾')).toBeTruthy();
  });

  test('a month without a plan: no report, a hint about the plan', async () => {
    await tap('Предыдущий месяц');
    await tap('Предыдущий месяц');
    expect(await screen.findByText('Август 2026')).toBeTruthy();
    expect(await screen.findByText('Составьте план на месяц во вкладке «План», чтобы видеть остаток по категориям.')).toBeTruthy();
    expect(screen.queryByText(/^Отложено |^Потрачено \d/)).toBeNull();
  });
});

describe('5.2–5.3 a day, a week, a year', () => {
  beforeEach(openStats);

  test('a week: by the limits\' rhythm; a weekly limit over its week; outside the plan', async () => {
    await period('За неделю');
    expect(await screen.findByText('12 окт 2026 – 18 окт 2026')).toBeTruthy();
    const t = texts();
    expect(t).toContain('Дневные лимиты');
    expect(t).toContain('Недельные лимиты');
    // the days' share of the month's plan, rebalanced: (620 − 220) / 20 × 7
    expect(block('🛒 Продукты').slice(1, 4)).toEqual(['85', ' / 140 ₾ (61%)', '20 ₾ → 24.23 ₾ Осталось 55 ₾ · до вс']);
    expect(block('☕️ Кафе и рестораны').slice(1, 4)).toEqual(['50', ' / 94.50 ₾ (53%)', '94.50 ₾ → 118.46 ₾ Осталось 44.50 ₾ · до вс']);
    expect(screen.getByText('320 ₾')).toBeTruthy();
    // the month's limit and the obligatory ones can't be judged by a week: not spent this week, not listed
    expect(screen.queryByText('👕 Одежда')).toBeNull();
  });

  test('a day: its daily limit, an overspend', async () => {
    await period('За день');
    expect(await screen.findByText('15 окт 2026')).toBeTruthy();
    expect(block('🛒 Продукты').slice(1, 4)).toEqual(['25', ' / 20 ₾ (125%)', '20 ₾ → 19.69 ₾ Перерасход 5 ₾']);
    // tomorrow isn't there yet
    await tap('Предыдущий период');
    expect(await screen.findByText('14 окт 2026')).toBeTruthy();
  });

  test('a year: the structure and the average over its full months with data', async () => {
    await period('За год');
    expect(await screen.findByText('2026')).toBeTruthy();
    expect(await screen.findByText('В среднем 1 850 ₾ в месяц (1 полный месяц)')).toBeTruthy();
    expect(block('🏠 Дом и коммуналка').slice(1, 3)).toEqual(['1 600 ₾ ', '38% всех трат']);
  });

  test('a day from the operations\' day header', async () => {
    await tap('Операции');
    await tap('Траты за день: Сегодня');
    expect(await screen.findByText('15 окт 2026')).toBeTruthy();
    expect(screen.getByText('за день')).toBeTruthy();
  });
});

describe('5.4–5.6 hidden amounts, the currency, the warning', () => {
  beforeEach(openStats);

  test('the eye hides the amounts, the % stay; remembered', async () => {
    await tap('Скрыть суммы бюджета');
    await waitFor(() => expect(screen.queryByText('1 645 / 2 160 ₾ (76%)')).toBeNull());
    expect(screen.getByText('76%')).toBeTruthy();
    expect(screen.getAllByText('49% плана').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^\d+% трат$/).length).toBeGreaterThan(0);
    expect(await getSetting('hide_amounts')).toBe('1');
  });

  test('the currency: the stats in dollars by the day\'s rate', async () => {
    const db = await getDb();
    for (let d = 1; d <= 15; d++) await db.run("INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, 'USD', 2.5)", [`2026-10-${String(d).padStart(2, '0')}`]);
    await tap('Настройки');
    await tap('$ USD');
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(await screen.findByText('Потрачено 804 / 984 $ (82%)')).toBeTruthy();
    expect(await getSetting('display_currency')).toBe('USD');
  });

  test('the warning: spending outside the plan past its share; ✕ hides it', async () => {
    expect(screen.getByText('⚠ Вне плана потрачено 380 ₾ — на 80 ₾ больше, чем выделено на незапланированное')).toBeTruthy();
    await tap('Скрыть предупреждение');
    await waitFor(() => expect(screen.queryByText(/^⚠ Вне плана/)).toBeNull());
  });
});
