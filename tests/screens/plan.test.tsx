// 6: the plan — the month's budget (what's locked, the share outside the plan, the leftover to savings), the
// categories in it, adding them, the next month. Today: 15 October 2026.
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { openApp, screen, tap, texts, toggleSwitch } from './app';
import { base, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';

async function openPlan(seed = planned) {
  await openApp(seed);
  await tap('Статистика');
  await tap('План');
  await screen.findByText('Бюджет месяца');
}
const month = async () => (await getDb()).get<{ b: number | null; l: number; p: number; u: number | null; s: number }>(
  "SELECT budget_minor AS b, locked_minor AS l, unplanned_pct AS p, unplanned_minor AS u, to_savings AS s FROM plan_months WHERE ym = '2026-10'");
const item = async (name: string, ym = '2026-10') => (await getDb()).get<{ a: number; kind: string; norm: string; pinned: number }>(
  `SELECT p.limit_minor AS a, p.kind, p.norm_period AS norm, p.pinned FROM plan_items p JOIN categories c ON c.id = p.category_id
    WHERE p.ym = ? AND c.name = ?`, [ym, name]);
/** the `n` texts after `label` (the first one after "Бюджет месяца": not the tabs on top) */
const after = (label: string, n = 3) => { const t = texts(); const i = t.indexOf(label, t.indexOf('Бюджет месяца')); return t.slice(i + 1, i + 1 + n); };

describe('6.1 the month\'s budget', () => {
  test('none yet: what is planned, set one', async () => {
    await openPlan(base);
    expect(screen.getByText(/^Запланировано 500 ₾\. Укажите бюджет месяца \(например, зарплату\)/)).toBeTruthy();
    await tap('Изменить бюджет месяца');
    expect(await screen.findByText('Уже запланировано: 500 ₾')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '3000');
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца сохранён')).toBeTruthy();
    expect(await month()).toMatchObject({ b: 300000, s: 1 });
    // its split: the plan, the rest to savings
    expect(await screen.findByText('3 000 ₾')).toBeTruthy();
    expect(after('План', 2)).toEqual(['500 ₾', '17%']);
  });

  test('the split: the plan, outside it, savings; the savings and the share as sections', async () => {
    await openPlan();
    expect(after('План', 2)).toEqual(['2 160 ₾', '72%']);
    expect(after('Вне плана', 2)).toEqual(['300 ₾', '10%']);
    expect(after('Сбережения', 2)).toEqual(['540 ₾', '18%']);
    expect(after('🔒 Сразу', 2)).toEqual(['заблокировано в начале месяца · 10% бюджета', '300 ₾']);
    expect(after('🌊 Что осталось', 2)).toEqual(['что не запланировано, плюс сэкономленное · 8% бюджета', '240 ₾']);
    expect(after('🎲 Траты вне плана', 2)).toEqual(['категории без плана и без категории · 10% бюджета', '300 ₾']);
  });

  test('the forecast: what the overspend leaves of the savings by the month\'s end', async () => {
    await openPlan();
    // 3 000 − (620 + 310 + 800 + 450 + 30) − 380 outside the plan
    expect(screen.getByText('Сбережения к концу месяца ≈ 410 ₾, если тратить по плану')).toBeTruthy();
  });

  test('less than what is planned with the locked and the share: refused', async () => {
    await openPlan();
    await tap('Изменить бюджет месяца');
    fireEvent.changeText(await screen.findByDisplayValue('3000'), '2500');
    await tap('Сохранить');
    expect(await screen.findByText(/По категориям уже запланировано 2 160 ₾ — вместе с отложенным и долей вне плана это больше бюджета\./)).toBeTruthy();
    expect((await month())!.b).toBe(300000);
  });

  test('removed: 0', async () => {
    await openPlan();
    await tap('Изменить бюджет месяца');
    fireEvent.changeText(await screen.findByDisplayValue('3000'), '0');
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца убран')).toBeTruthy();
    expect(await month()).toMatchObject({ b: null, l: 0, u: null });
  });
});

describe('6.2 locked for savings, the share outside the plan, the leftover', () => {
  beforeEach(() => openPlan());
  const sliders = () => screen.UNSAFE_root.findAll((n: { props: { accessibilityRole?: string; onAccessibilityAction?: unknown } }) =>
    n.props.accessibilityRole === 'adjustable' && typeof n.props.onAccessibilityAction === 'function');
  const step = (i: number, actionName: 'increment' | 'decrement') => act(() => { fireEvent(sliders()[i], 'accessibilityAction', { nativeEvent: { actionName } }); });

  test('what doesn\'t fit can\'t be picked; less is', async () => {
    await tap('Изменить бюджет месяца');
    expect(await screen.findByText('300 ₾ сразу в сбережения: план и траты вне плана их не займут.')).toBeTruthy();
    // 20% (600) doesn't fit next to the plan and the share
    await step(0, 'increment');
    expect(screen.getByText('300 ₾ сразу в сбережения: план и траты вне плана их не займут.')).toBeTruthy();
    await step(0, 'decrement');
    expect(await screen.findByText('Сколько бюджета сразу заблокировать для сбережений: план и траты вне плана их не займут.')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца сохранён')).toBeTruthy();
    expect((await month())!.l).toBe(0);
    await waitFor(() => expect(screen.queryByText('🔒 Сразу')).toBeNull());
  });

  test('an amount of one\'s own instead of the %', async () => {
    await tap('Изменить бюджет месяца');
    await screen.findByText('На траты вне плана');
    // the second share's switch: % → the amount
    const amountTabs = screen.getAllByText('GEL');
    await tap(amountTabs[amountTabs.length - 1]);
    fireEvent.changeText(screen.getByDisplayValue('300'), '250');
    expect(await screen.findByText('250 ₾ на траты вне плана — план их не займёт.')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('250'), '900');
    expect(await screen.findByText('Не помещается: свободно 540 ₾ — остальное занято планом и отложенным.')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('900'), '250');
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца сохранён')).toBeTruthy();
    expect(await month()).toMatchObject({ u: 25000 });
  });

  test('the leftover not to savings: "Свободно" and "Отложено" apart', async () => {
    await tap('Изменить бюджет месяца');
    await screen.findByText('Что останется — в сбережения');
    toggleSwitch(false);
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца сохранён')).toBeTruthy();
    expect((await month())!.s).toBe(0);
    expect(after('Свободно', 2)).toEqual(['240 ₾', '8%']);
    expect(after('Отложено', 2)).toEqual(['300 ₾', '10%']);
  });
});

describe('6.3 the categories in the plan', () => {
  beforeEach(() => openPlan());

  test('a row: its limit per rhythm, its share of the budget; the obligatory ones', async () => {
    expect(after('🛒 Продукты', 2)).toEqual(['лимит ≈ 20 ₾ в день · 21% бюджета', '620 ₾']);
    expect(after('☕️ Кафе и рестораны', 2)).toEqual(['лимит ≈ 70 ₾ в неделю · 10% бюджета', '310 ₾']);
    expect(after('🏠 Дом и коммуналка', 2)).toEqual(['обязательный платёж · 27% бюджета', '800 ₾']);
    expect(after('👕 Одежда', 2)).toEqual(['крупно, раз в месяц · 13% бюджета', '400 ₾']);
  });

  test('an amount: what helps to pick it; more than is free refused; saved', async () => {
    await tap('Изменить: 🛒 Продукты');
    expect(await screen.findByText('Можно запланировать')).toBeTruthy();
    expect(after('Можно запланировать', 1)).toEqual(['до 860 ₾']);
    expect(after('В плане на сентябрь', 1)).toEqual(['600 ₾']);
    expect(after('В среднем в месяц (1 полный месяц)', 1)).toEqual(['≈ 500 ₾']);
    fireEvent.changeText(screen.getByDisplayValue('620'), '900');
    await tap('Сохранить');
    expect(await screen.findByText(/Больше бюджета месяца: можно запланировать до 860 ₾/)).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('900'), '700');
    await tap('Раз в неделю · ≈ 158.06 ₾ в неделю');
    await tap('Сохранить');
    expect(await screen.findByText('План «🛒 Продукты» сохранён')).toBeTruthy();
    expect(await item('Продукты')).toMatchObject({ a: 70000, kind: 'limit', norm: 'week' });
  });

  test('📌: repeated every month; removing such a one asks', async () => {
    await tap(screen.getAllByLabelText('Повторять каждый месяц')[0]);
    expect(await screen.findByText(/«.*» будет повторяться каждый месяц/)).toBeTruthy();
    const pinned = (await (await getDb()).get<{ name: string }>("SELECT c.name FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = '2026-10' AND p.pinned = 1"))!.name;
    await tap(new RegExp(`^Изменить: .*${pinned}$`));
    await tap('Удалить из плана');
    expect(await screen.findByText(/^Убрать «.*» из плана\?$/)).toBeTruthy();
    expect(screen.getByText('Эта категория повторяется каждый месяц (📌). Она пропадёт из плана этого месяца и не перейдёт в следующие. Операции не изменятся.')).toBeTruthy();
    await tap('Убрать из плана');
    expect(await screen.findByText(/^«.*» убрана из плана$/)).toBeTruthy();
    expect(await item(pinned)).toBeUndefined();
  });

  test('removing one not repeated: at once', async () => {
    await tap('Изменить: 👕 Одежда');
    await tap('Удалить из плана');
    expect(await screen.findByText('«👕 Одежда» убрана из плана')).toBeTruthy();
    expect(await item('Одежда')).toBeUndefined();
  });

  test('adding several: what is free, the amounts; more than is free refused', async () => {
    await tap('Добавить категории в план');
    expect(await screen.findByText('Свободно: 240 ₾')).toBeTruthy();
    expect(screen.queryByLabelText('Сумма: 🏦 Сбережения')).toBeNull();
    expect(screen.queryByLabelText('Сумма: 🛒 Продукты')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Сумма: 🚕 Такси'), '300');
    await tap('Добавить (1)');
    expect(await screen.findByText(/Больше бюджета месяца: свободно 240 ₾/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Сумма: 🚕 Такси'), '100');
    fireEvent.changeText(screen.getByLabelText('Сумма: 🎮 Развлечения'), '100');
    await tap('Добавить (2)');
    expect(await screen.findByText('Добавлено в план: 2 категории')).toBeTruthy();
    expect(await item('Такси')).toMatchObject({ a: 10000 });
  });
});

describe('6.1.11 the next month', () => {
  test('carried over: the budget and its settings; amounts to fill in, last month\'s as a hint', async () => {
    await openPlan();
    await tap('Следующий месяц');
    expect(await screen.findByText('Ноябрь 2026')).toBeTruthy();
    expect(await screen.findByText('3 000 ₾')).toBeTruthy();
    expect(after('🛒 Продукты', 1)).toEqual(['в прошлом месяце 620 ₾']);
    expect(screen.getByLabelText('Следующий месяц').props.accessibilityState?.disabled ?? true).toBeTruthy();
    const nov = await (await getDb()).get<{ b: number; l: number; p: number }>("SELECT budget_minor AS b, locked_minor AS l, unplanned_pct AS p FROM plan_months WHERE ym = '2026-11'");
    expect(nov).toMatchObject({ b: 300000, l: 30000, p: 10 });
  });
});
