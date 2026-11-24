// 6: the plan — its «План» tab (the categories' plans) and changed in the month's stats — the month's budget (what's locked, the share outside
// the plan, the leftover to savings), the categories in it, adding them («＋»), the next month. Today: 15 October 2026.
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { back, openApp, screen, tap, texts, backToTabs, toggleSwitch, openBudget, openPlanOf, openNextMonth, openMenu, openSettings } from './app';
import { base, empty, lateFund, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { emitTransactionsChanged } from '../../src/domain/events';

async function openPlan(seed = planned) {
  await openApp(seed);
  await tap('Статистика');
  await screen.findByLabelText('Добавить в план');
}
const month = async () => (await getDb()).get<{ b: number | null; l: number; lp: number | null; p: number; u: number | null; s: number }>(
  "SELECT budget_minor AS b, locked_minor AS l, locked_pct AS lp, unplanned_pct AS p, unplanned_minor AS u, to_savings AS s FROM plan_months WHERE ym = '2026-10'");
const item = async (name: string, ym = '2026-10') => (await getDb()).get<{ a: number; kind: string; norm: string; pinned: number }>(
  `SELECT p.limit_minor AS a, p.kind, p.norm_period AS norm, p.pinned FROM plan_items p JOIN categories c ON c.id = p.category_id
    WHERE p.ym = ? AND c.name = ?`, [ym, name]);
/** the `n` texts after `label` (its last one: a sheet comes after the stats) */
const after = (label: string, n = 3) => { const t = texts(); const i = t.lastIndexOf(label); return t.slice(i + 1, i + 1 + n); };
/** a section's band in the stats: its title with its share of the budget, «Жизнь · 35%» */
// the seed's categories have no section: savings 540 ₾, the plan 2 160 ₾ and the share outside it 300 ₾ of 3 000 ₾
const SECTIONS = ['Без раздела · 72% бюджета', 'Вне плана · 10% бюджета', 'Сбережения · 18% бюджета'];
const sectionTitles = () => texts().filter((t) => / · (\d+|<1)% (бюджета|плана)$/.test(t));

describe('6.1 the month\'s budget', () => {
  test('none yet: a tap on «Потрачено … / …» — the budget\'s sheet, what is planned; set one', async () => {
    await openPlan(base);
    // no budget: the sections\' shares of the whole plan
    expect(sectionTitles().length).toBeGreaterThan(0);
    await openBudget();
    expect(await screen.findByText('Уже запланировано: 500 ₾')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '3000');
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца сохранён')).toBeTruthy();
    expect(await month()).toMatchObject({ b: 300000, s: 1 });
  });

  test('a section\'s title: its plan\'s share of the budget; no «Изменить план ›», no plan page', async () => {
    await openPlan();
    expect(sectionTitles()).toEqual(SECTIONS);
    expect(screen.queryByText(/Изменить план|Составить план/)).toBeNull();
  });

  test('6.3.5a a one-off payment\'s optional day in its sheet: saved on its item, «Убрать» takes it off', async () => {
    await openPlan();
    await openPlanOf('🏠 Дом и коммуналка');
    expect(await screen.findByText('Дата списания (необязательно)')).toBeTruthy();
    expect(screen.getByText('С датой платёж встанет на шкалу месяца в статистике.')).toBeTruthy();
    await tap('Выбрать дату');
    await tap('#day-2026-10-01');
    await tap('Выбрать');
    await tap('Сохранить');
    const db = await getDb();
    const due = () => db.get("SELECT p.due FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = '2026-10' AND c.name = 'Дом и коммуналка'");
    await waitFor(async () => expect(await due()).toEqual({ due: '2026-10-01' }));
    // the sheet closed before it is opened again
    await waitFor(() => expect(screen.queryByText('Дата списания (необязательно)')).toBeNull());
    await openPlanOf('🏠 Дом и коммуналка');
    expect(await screen.findByText(/^1 октября 2026/)).toBeTruthy();
    await tap('Убрать: Дата списания (необязательно)');
    await tap('Сохранить');
    await waitFor(async () => expect(await due()).toEqual({ due: null }));
  });

  test('a month without a plan: the hint, «＋», «Бюджет месяца ›» — its sheet', async () => {
    await openApp(empty);
    await tap('Статистика');
    expect(await screen.findByText(/^Составьте план на месяц/)).toBeTruthy();
    expect(screen.getByLabelText('Добавить в план')).toBeTruthy();
    await tap('Бюджет месяца ›');
    expect(await screen.findByText('Сохранить')).toBeTruthy();
  });

  test('the stats\' «Сбережения»: what the overspend took, ⓘ — the same sheet', async () => {
    await openApp(planned);
    await tap('Статистика');
    expect(await screen.findByText('Перерасход взял 130 ₾ ')).toBeTruthy();
    await tap('💰 Сэкономлено: что съело сбережения');
    expect(await screen.findByText('Сбережения меньше на 130 ₾')).toBeTruthy();
  });

  test('less than what is planned with the locked and the share: refused', async () => {
    await openPlan();
    await openBudget();
    fireEvent.changeText(await screen.findByDisplayValue('3000'), '2500');
    await tap('Сохранить');
    expect(await screen.findByText(/По категориям уже запланировано 2 160 ₾ — вместе с отложенным и долей вне плана это больше бюджета\./)).toBeTruthy();
    expect((await month())!.b).toBe(300000);
  });

  test('removed: 0', async () => {
    await openPlan();
    await openBudget();
    fireEvent.changeText(await screen.findByDisplayValue('3000'), '0');
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца убран')).toBeTruthy();
    expect(await month()).toMatchObject({ b: null, l: 0, u: null });
  });
});

test('6.3.13 the «План» tab: the categories\' plans by section, no spending; a row — its amount\'s sheet', async () => {
  await openPlan();
  await tap('План');
  // the row (the legend has its name too)
  expect(await screen.findByLabelText('Изменить: 🛒 Продукты')).toBeTruthy();
  // the plan's ring over them: «Бюджет» in its hole
  expect(screen.getByText('Бюджет')).toBeTruthy();
  expect(texts()).toEqual(expect.arrayContaining(['Без раздела', '🏠 Дом и коммуналка', 'разовый платёж', '👕 Одежда']));
  // «Сбережения»: 🔒 the settings' 10% of the budget; a tap — the budget
  expect(texts()).toEqual(expect.arrayContaining(['Сбережения', '🔒 Отложено сразу', 'заблокировано в начале месяца', '300 ₾']));
  await tap('Изменить: 🔒 Отложено сразу');
  expect(await screen.findByText('Бюджет месяца')).toBeTruthy();
  await tap('Отмена');
  // only the categories' plans: no spending sections («Вне плана · 10% бюджета», «Сбережения · …»), no «Осталось»
  expect(sectionTitles()).toEqual([]);
  expect(screen.queryByText(/^Осталось/)).toBeNull();
  // «Траты»: the stats again
  await tap('Траты');
  expect(await screen.findByText('Потрачено')).toBeTruthy();
  expect(screen.queryByText('разовый платёж')).toBeNull();
  // a row of the plan: its amount's sheet
  await tap('План');
  await tap('Изменить: 🛒 Продукты');
  expect(await screen.findByText('Удалить из плана')).toBeTruthy();
});

test('6.3.13 the «План» tab: «Сбережения» — the funds with their goal; a tap — the fund\'s card', async () => {
  await openPlan(lateFund);
  await tap('План');
  expect(await screen.findByLabelText('Копилка: 👕 Одежда')).toBeTruthy();
  expect(texts()).toContain('Сбережения');
  expect(texts().some((t) => / из 4 000 ₾ · /.test(t))).toBe(true);
  await tap('Копилка: 👕 Одежда');
  expect(await screen.findByText(/Изменить/)).toBeTruthy();
});

test('6.3.13 the «План» tab of a month without a plan: the hint', async () => {
  await openApp(empty);
  await tap('Статистика');
  await tap('План');
  expect(await screen.findByText('План пуст. Нажмите ＋, чтобы добавить категории и суммы.')).toBeTruthy();
});

describe('6.2 locked for savings, the share outside the plan, the leftover', () => {
  beforeEach(() => openPlan());
  const sliders = () => screen.UNSAFE_root.findAll((n: { props: { accessibilityRole?: string; onAccessibilityAction?: unknown } }) =>
    n.props.accessibilityRole === 'adjustable' && typeof n.props.onAccessibilityAction === 'function');
  const step = (i: number, actionName: 'increment' | 'decrement') => act(() => { fireEvent(sliders()[i], 'accessibilityAction', { nativeEvent: { actionName } }); });

  test('6.2.1 🔒 — no field: the settings\' % of the amount typed, «Процент — в Настройках ›»; what is free in the plan', async () => {
    await openBudget();
    expect(await screen.findByText('ОТЛОЖИТЬ СРАЗУ')).toBeTruthy();
    expect(screen.getByText('10% · 300 ₾')).toBeTruthy();
    expect(screen.getByText('Сразу в сбережения: план и траты вне плана их не займут.')).toBeTruthy();
    // 3 000 − 2 160 planned − 300 🔒 − 300 outside the plan
    expect(screen.getByText('Свободно в плане: 240 ₾ — не распределите, уйдёт в 💰 Сэкономлено')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'MAX' })).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('3000'), '4000');
    expect(await screen.findByText('10% · 400 ₾')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца сохранён')).toBeTruthy();
    expect(await month()).toMatchObject({ b: 400000, l: 40000 });
    await openBudget();
    await tap('Процент — в Настройках ›');
    expect(await screen.findByText('🔒 Отложить сразу')).toBeTruthy();
    expect(screen.getByText('10% бюджета')).toBeTruthy();
  });

  test('6.2.2 taken from 🔒 this month: what is left of it, «плану не хватило свободного», this month only', async () => {
    await (await getDb()).run("UPDATE plan_months SET locked_minor = 25000, locked_taken_minor = 5000 WHERE ym = '2026-10'");
    act(() => emitTransactionsChanged());
    await openBudget();
    expect(await screen.findByText('250 ₾')).toBeTruthy();
    expect(texts()).toEqual(expect.arrayContaining(['10% бюджета', '300 ₾', 'плану не хватило свободного', '−50 ₾',
      'Только в этом месяце: процент в Настройках не меняется.', 'Настройки ›']));
  });

  test('6.2.4 a new % in the settings: this month\'s 🔒 at once', async () => {
    await openSettings();
    const slider = await waitFor(() => screen.UNSAFE_root.find((n: { props: { accessibilityRole?: string; accessibilityValue?: { text?: string } } }) =>
      n.props.accessibilityRole === 'adjustable' && n.props.accessibilityValue?.text === '10%'));
    act(() => { fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }); });
    expect(await screen.findByText('15% бюджета')).toBeTruthy();
    await waitFor(async () => expect(await month()).toMatchObject({ l: 45000, lp: 15 }));
    backToTabs();
    await openBudget();
    expect(await screen.findByText('15% · 450 ₾')).toBeTruthy();
  });

  test('an amount of one\'s own instead of the %', async () => {
    await openBudget();
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

  test('the leftover: always in "Сбережения" — where it goes is asked in "Итоги месяца", no switch in the budget', async () => {
    await openBudget();
    await screen.findByText('На траты вне плана');
    expect(screen.queryByText('Что останется — в сбережения')).toBeNull();
    expect(screen.queryByText('Свободно')).toBeNull();
  });
});

test('6.2.3 «🔒 Отложить сразу» not set: a warning in the budget, «Задать в Настройках ›»', async () => {
  await openPlan(async () => {
    await planned();
    const db = await getDb();
    await db.run("DELETE FROM app_settings WHERE key = 'locked_pct'");
    await db.run("UPDATE plan_months SET locked_minor = 0, locked_pct = NULL WHERE ym = '2026-10'");
  });
  await openBudget();
  expect(await screen.findByText('⚠ Не задано, сколько откладывать сразу: в сбережения уйдёт только то, что останется в конце месяца.')).toBeTruthy();
  expect(screen.queryByText('ОТЛОЖИТЬ СРАЗУ')).toBeNull();
  await tap('Задать в Настройках ›');
  expect(await screen.findByText('не задано')).toBeTruthy();
});

/** From an item's sheet in the plan to its category's page: «В плане» — «Регулярный платёж», «Настроить». */
async function regularSetup(label: string) {
  await openPlanOf(label);
  await tap('Изменить в категории ›');
  await screen.findByText(/^Обеды, аренда, страховка/);
  await tap('Регулярный платёж');
  await tap('Настроить');
  await screen.findByText('Как часто');
}

describe('6.3 the categories in the plan', () => {
  beforeEach(() => openPlan());

  test('an amount: what helps to pick it; more than is free refused; saved', async () => {
    await openPlanOf('🛒 Продукты');
    expect(await screen.findByText('Можно запланировать')).toBeTruthy();
    expect(after('Можно запланировать', 1)).toEqual(['до 860 ₾']);
    // what is spent: here only, not in the plan's list
    expect(after('Потрачено в октябре', 1)).toEqual(['305 ₾']);
    expect(after('В плане на сентябрь', 1)).toEqual(['600 ₾']);
    expect(after('В среднем в месяц (1 полный месяц)', 1)).toEqual(['≈ 500 ₾']);
    // more than what is free and 🔒 together
    fireEvent.changeText(screen.getByDisplayValue('620'), '1300');
    await tap('Сохранить');
    expect(await screen.findByText(/Больше бюджета месяца: можно запланировать до 860 ₾/)).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('1300'), '700');
    await tap('Раз в неделю · ≈ 158.06 ₾ в неделю');
    await tap('Сохранить');
    expect(await screen.findByText('План «🛒 Продукты» сохранён')).toBeTruthy();
    expect(await item('Продукты')).toMatchObject({ a: 70000, kind: 'limit', norm: 'week' });
  });

  test('the category\'s name in the title opens its sheet over the amount, as on the operation\'s card', async () => {
    await openPlanOf('🛒 Продукты');
    await tap('Открыть: 🛒 Продукты');
    expect(await screen.findByDisplayValue('Продукты')).toBeTruthy();
    // the repeating payments are turned on and off in the plan only
    expect(screen.queryByText('Регулярные платежи')).toBeNull();
  });

  test('the sheet: what the item is (its category\'s kind), «Изменить в категории ›» — its page; no kind to pick, nothing repeated by hand', async () => {
    await openPlanOf('👕 Одежда');
    expect(await screen.findByText('Траты с лимитом')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Разовый платёж/ })).toBeNull();
    expect(screen.queryByText('Повторять каждый месяц')).toBeNull();
    await tap('Изменить в категории ›');
    expect(await screen.findByText(/^Еда, кафе, одежда/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Траты с лимитом/, checked: true })).toBeTruthy();
  });

  test('6.3.10 the kind on the category\'s page: a one-off payment saved at once — gone from the coming months; a regular payment — «Настроить»', async () => {
    await openPlanOf('👕 Одежда');
    await tap('Изменить в категории ›');
    await screen.findByText('Сумма и «Как тратите» — в плане месяца; дальше переходят в следующие.');
    await tap('Регулярный платёж');
    expect(await screen.findByText('Настроить')).toBeTruthy();
    expect(screen.queryByText('Импульсивные покупки')).toBeTruthy();
    await tap('Разовый платёж');
    expect(await screen.findByText('В следующий месяц не переходит.')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('«👕 Одежда»: вид в плане сохранён')).toBeTruthy();
    const db = await getDb();
    expect(await db.get("SELECT plan_kind FROM categories WHERE name = 'Одежда'")).toEqual({ plan_kind: 'oneoff' });
    expect(await item('Одежда')).toMatchObject({ kind: 'fixed' });
    // the plan's sheet of this month at once, its amount as it was; "‹ Назад" — the page left, nothing changed
    expect(await screen.findByText('‹ Назад')).toBeTruthy();
    expect(screen.getByDisplayValue('400')).toBeTruthy();
    await tap('‹ Назад');
    await waitFor(() => expect(screen.queryByText('В следующий месяц не переходит.')).toBeNull());
    expect(await screen.findAllByText('👕 Одежда')).toBeTruthy();
    expect(await item('Одежда')).toMatchObject({ a: 40000 });
    // a limit again: its amount there (400) — kept, no plan's sheet
    await openPlanOf('👕 Одежда');
    await tap('Изменить в категории ›');
    await tap(await screen.findByText('Траты с лимитом'));
    await tap('Сохранить');
    expect(await screen.findByText('«👕 Одежда»: вид в плане сохранён')).toBeTruthy();
    expect(screen.queryByText('‹ Назад')).toBeNull();
    expect(await item('Одежда')).toMatchObject({ a: 40000, kind: 'limit' });
  });

  test('a regular payment within the month: every week on Mondays and Thursdays — the times by the amount; carried over each month till its end', async () => {
    await regularSetup('👕 Одежда');
    // a category without "Подписки": how often, no operation to pick
    expect(screen.queryByText('Выбрать операцию')).toBeNull();
    // rarer than monthly: its amount asked here (ahead of its month); every day, week or month — in the plan
    await tap('Раз в год');
    expect(await screen.findByText('Сумма платежа')).toBeTruthy();
    await tap('Каждую неделю');
    expect(await screen.findByText('Выберите дни недели')).toBeTruthy();
    // on its page: how often only — the amount is the plan's
    expect(screen.queryByText('Сумма за раз')).toBeNull();
    await tap('пн');
    await tap('чт');
    // October: 4 Mondays, 5 Thursdays
    expect(await screen.findByText('9 раз в октябре')).toBeTruthy();
    // no "Повторять каждый месяц": always carried over, its end ends it
    expect(screen.getByText('Повторяется каждый месяц, пока не задана дата окончания.')).toBeTruthy();
    expect(screen.queryByText('Повторять каждый месяц')).toBeNull();
    expect(screen.getByText('Дата окончания (необязательно)')).toBeTruthy();
    await tap('Сохранить');
    // the plan's sheet at once: the amount each time, how often shown
    expect(await screen.findByText('Сумма за раз')).toBeTruthy();
    expect(screen.getByText('‹ Назад')).toBeTruthy();
    expect(screen.getAllByText('пн, чт').length).toBeGreaterThan(0);
    expect(screen.getByText('Как часто, дата списания и окончания — на странице категории. Сумма переходит в следующие месяцы.')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '20');
    expect(await screen.findByText('9 раз в октябре — 180\u00a0₾')).toBeTruthy();
    await tap('Сохранить');
    expect((await screen.findAllByText('План «👕 Одежда» сохранён')).length).toBeGreaterThan(0);
    expect(await (await getDb()).get("SELECT p.limit_minor AS a, p.kind, p.every, p.weekdays, p.unit_minor AS u FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = '2026-10' AND c.name = 'Одежда'"))
      .toEqual({ a: 18000, kind: 'fixed', every: 'week', weekdays: 9, u: 2000 });
    // its sheet in the plan: the amount each time, how often — its category's
    await openPlanOf('👕 Одежда');
    expect(await screen.findByText('Сумма за раз')).toBeTruthy();
    expect(screen.getByDisplayValue('20')).toBeTruthy();
    expect(screen.queryByText('Каждую неделю')).toBeNull();
    // removed: asked — the payment off, gone from this month on; "Отменить" — back
    await tap('Удалить из плана');
    expect(await screen.findByText('У категории регулярный платёж — он выключится, а категория пропадёт из плана с октября. Операции не изменятся.')).toBeTruthy();
    await tap('Убрать из плана');
    expect(await screen.findByText('«👕 Одежда» убрана из плана, регулярный платёж выключен')).toBeTruthy();
    expect(await item('Одежда')).toBeUndefined();
    expect(await (await getDb()).get("SELECT count(*) AS n FROM category_schedules")).toEqual({ n: 0 });
    await tap('Отменить');
    expect(await screen.findByText('«👕 Одежда» снова в плане')).toBeTruthy();
    expect(await item('Одежда')).toMatchObject({ a: 18000 });
  });

  test('a regular payment within the month past what is free and 🔒: asked too — all of 🔒 taken, the plan over its budget', async () => {
    // 2 400 ₾ to plan, 2 160 planned (Одежда 400) — 240 free, 🔒 300; пн и чт × 120 = 1 080 ₾: 680 more, 440 short
    await regularSetup('👕 Одежда');
    await tap('Каждую неделю');
    await tap('пн');
    await tap('чт');
    await tap('Сохранить');
    // the amount in the plan's sheet that opens at once
    expect(await screen.findByText('Сумма за раз')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '120');
    await tap('Сохранить');
    expect(await screen.findByText('Свободного не хватает 440\u00a0₾, в сбережениях — 300\u00a0₾. План будет больше бюджета на 140\u00a0₾.')).toBeTruthy();
    await tap('Вычесть и сохранить');
    expect(await screen.findByText('План «👕 Одежда» сохранён, из 🔒 вычтено 300\u00a0₾')).toBeTruthy();
    const db = await getDb();
    expect(await db.get("SELECT locked_minor FROM plan_months WHERE ym = '2026-10'")).toEqual({ locked_minor: 0 });
    expect(await db.get("SELECT p.limit_minor AS a FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = '2026-10' AND c.name = 'Одежда'")).toEqual({ a: 108000 });
  });

  test('removing one not repeated: at once; "Отменить" brings it back as it was', async () => {
    const before = await item('Одежда');
    await openPlanOf('👕 Одежда');
    await tap('Удалить из плана');
    expect(await screen.findByText('«👕 Одежда» убрана из плана')).toBeTruthy();
    expect(await item('Одежда')).toBeUndefined();
    await tap('Отменить');
    expect(await screen.findByText('«👕 Одежда» снова в плане')).toBeTruthy();
    expect(await item('Одежда')).toEqual(before);
    expect(await screen.findAllByText('👕 Одежда')).toBeTruthy();
  });

  test('more than is free, 🔒 has it: "Вычесть из сбережений?" — what is short taken from it', async () => {
    await openPlanOf('👕 Одежда');
    fireEvent.changeText(await screen.findByDisplayValue('400'), '700');
    await tap('Сохранить');
    expect(await screen.findByText('Вычесть из сбережений?')).toBeTruthy();
    expect(screen.getByText('Свободного не хватает 60 ₾ — их можно взять из сбережений.')).toBeTruthy();
    expect(texts()).toEqual(expect.arrayContaining(['🔒 Отложить сразу', '300 ₾', '240 ₾', '(−20%)']));
    await tap('Вычесть и сохранить');
    expect(await screen.findByText('План «👕 Одежда» сохранён, из 🔒 вычтено 60 ₾')).toBeTruthy();
    expect(await item('Одежда')).toMatchObject({ a: 70000 });
    expect(await month()).toMatchObject({ l: 24000 });
  });

  test('"Отмена" on the question: nothing saved, the amount still open', async () => {
    await openPlanOf('👕 Одежда');
    fireEvent.changeText(await screen.findByDisplayValue('400'), '700');
    await tap('Сохранить');
    await screen.findByText('Вычесть из сбережений?');
    await tap('Отмена');
    expect(await screen.findByDisplayValue('700')).toBeTruthy();
    expect(await item('Одежда')).toMatchObject({ a: 40000 });
    expect(await month()).toMatchObject({ l: 30000 });
  });
});

describe('6.3.12 a limit cut while the spending outside the plan is past its share', () => {
  // the share 300 ₾, outside the plan 380 ₾ spent (Такси, Развлечения, a transfer): 80 ₾ past it
  beforeEach(() => openPlan());
  const cover = async () => (await (await getDb()).get<{ c: number | null }>("SELECT unplanned_cover_minor AS c FROM plan_months WHERE ym = '2026-10'"))?.c;
  const cut = async (to: string) => {
    await openPlanOf('☕️ Кафе и рестораны');
    fireEvent.changeText(await screen.findByDisplayValue('310'), to);
    await tap('Сохранить');
  };

  test('«Покрыть»: as much as is past the share, this month; «Отменить» — as it was', async () => {
    await cut('200');
    expect(await screen.findByText('Покрыть перерасход вне плана?')).toBeTruthy();
    expect(screen.getByText('Траты вне плана больше доли на 80 ₾. Из освободившихся 110 ₾ им можно отдать 80 ₾ — иначе всё уйдёт в сбережения.')).toBeTruthy();
    await tap('Покрыть 80 ₾');
    expect(await screen.findByText('Перерасход вне плана покрыт')).toBeTruthy();
    expect(await cover()).toBe(8000);
    await tap('Отменить');
    expect(await screen.findByText('Покрытие перерасхода отменено')).toBeTruthy();
    await waitFor(async () => expect(await cover()).toBeFalsy());
    expect(await item('Кафе и рестораны')).toMatchObject({ a: 20000 });
  });
  test('«В сбережения»: the share as it was', async () => {
    await cut('290');
    expect(await screen.findByText('Траты вне плана больше доли на 80 ₾. Освободившиеся 20 ₾ можно отдать им — иначе всё уйдёт в сбережения.')).toBeTruthy();
    await tap('В сбережения');
    await waitFor(() => expect(screen.queryByText('Покрыть перерасход вне плана?')).toBeNull());
    expect(await cover()).toBeFalsy();
  });
  test('raised, or a payment: not asked', async () => {
    await cut('400');
    expect(await screen.findByText('План «☕️ Кафе и рестораны» сохранён')).toBeTruthy();
    expect(screen.queryByText('Покрыть перерасход вне плана?')).toBeNull();
  });
  test('past month (currentYm is November, ym is October): still asked', async () => {
    // Advance clock to November 1 so currentYm() = '2026-11' while the stats page still shows October.
    const Real = Object.getPrototypeOf(Date) as DateConstructor;
    const realNow = Real.now;
    await openPlanOf('☕️ Кафе и рестораны');
    fireEvent.changeText(await screen.findByDisplayValue('310'), '200');
    const spy = jest.spyOn(Real, 'now').mockImplementation(() => realNow.call(Real) + 17 * 86400000);
    try {
      await tap('Сохранить');
      expect(await screen.findByText('Покрыть перерасход вне плана?')).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('6.3.2 adding to the plan, step by step', () => {
  beforeEach(() => openPlan());

  test('step 1: the month before\'s plan, then spent in this month, then the rest; none in the plan or system', async () => {
    // Кафе out of this month's plan: it was in September's
    await (await getDb()).run("DELETE FROM plan_items WHERE ym = '2026-10' AND category_id = (SELECT id FROM categories WHERE name = 'Кафе и рестораны')");
    act(() => emitTransactionsChanged());
    await tap('Добавить в план');
    expect(await screen.findByText('Шаг 1 из 2 · Категория')).toBeTruthy();
    expect(screen.getByText('Свободно: 550 ₾ · траты — за октябрь')).toBeTruthy();
    const t = texts();
    // the last: the stats under the page have the same names
    const at = (s: string) => t.lastIndexOf(s);
    expect(at('В плане сентября')).toBeGreaterThan(-1);
    expect(t[at('☕️ Кафе и рестораны') + 1]).toBe('план 300 ₾ · потрачено 90 ₾');
    expect(at('С тратами в октябре')).toBeGreaterThan(at('☕️ Кафе и рестораны'));
    expect(t[at('🎮 Развлечения') + 1]).toBe('потрачено 300 ₾');
    expect(t[at('🚕 Такси') + 1]).toBe('потрачено 60 ₾');
    expect(at('🎮 Развлечения')).toBeGreaterThan(at('С тратами в октябре'));
    expect(screen.queryByLabelText('Добавить в план: 🛒 Продукты')).toBeNull();
    expect(screen.queryByLabelText(/Добавить в план: .*Сбережения/)).toBeNull();
  });

  test('step 2: the amount sheet; "‹ Назад" to the categories; added', async () => {
    await tap('Добавить в план');
    await tap('Добавить в план: 🚕 Такси');
    expect(await screen.findByText('Шаг 2 из 2 · Сумма')).toBeTruthy();
    expect(screen.queryByText('Удалить из плана')).toBeNull();
    await tap('‹ Назад');
    expect(await screen.findByText('Шаг 1 из 2 · Категория')).toBeTruthy();
    await tap('Добавить в план: 🚕 Такси');
    fireEvent.changeText(await screen.findByPlaceholderText('0'), '100');
    await tap('Добавить в план');
    expect(await screen.findByText('«🚕 Такси» добавлена в план')).toBeTruthy();
    expect(await item('Такси')).toMatchObject({ a: 10000 });
  });

  test('more than is free: "Вычесть и добавить" takes it from 🔒; more than 🔒 too — refused', async () => {
    await tap('Добавить в план');
    await tap('Добавить в план: 🚕 Такси');
    fireEvent.changeText(await screen.findByPlaceholderText('0'), '600');
    await tap('Добавить в план');
    expect(await screen.findByText(/Больше бюджета месяца: можно запланировать до 240 ₾/)).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('600'), '300');
    await tap('Добавить в план');
    expect(await screen.findByText('Свободного не хватает 60 ₾ — их можно взять из сбережений.')).toBeTruthy();
    await tap('Вычесть и добавить');
    expect(await screen.findByText('«🚕 Такси» в плане, из 🔒 вычтено 60 ₾')).toBeTruthy();
    expect(await item('Такси')).toMatchObject({ a: 30000 });
    expect(await month()).toMatchObject({ l: 24000 });
  });
});

describe('6.3.2a search in «Добавить в план»', () => {
  beforeEach(async () => {
    await openPlan();
    await tap('Добавить в план');
    await screen.findByText('Шаг 1 из 2 · Категория');
  });

  test('typing filters categories; group headers hidden; clear (×) restores full list', async () => {
    expect(screen.getByText('С тратами в октябре')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Найти категорию'), 'такс');
    expect(screen.queryByText('С тратами в октябре')).toBeNull();
    expect(screen.getByLabelText('Добавить в план: 🚕 Такси')).toBeTruthy();
    await tap('Очистить поиск');
    expect(await screen.findByText('С тратами в октябре')).toBeTruthy();
  });

  test('no match shows «Не найдено.»', async () => {
    fireEvent.changeText(screen.getByPlaceholderText('Найти категорию'), 'zzz');
    expect(await screen.findByText('Не найдено.')).toBeTruthy();
  });
});

describe('6.1.11 the next month', () => {
  test('carried over: the budget and its settings; a limit with its amount; the month\'s stats — its plan, nothing spent', async () => {
    await openApp(planned);
    await tap('Статистика');
    await openNextMonth();
    expect(screen.queryByText(/ещё не начался/)).toBeNull();
    expect(await screen.findByText('🛒 Продукты')).toBeTruthy();
    // nothing spent: what is left — all of it; the sections with their shares of November's budget (Дом, one-off, stayed in October)
    expect(texts()).toEqual(expect.arrayContaining(['Осталось 1 660 ₾ · до 30 ноя', 'Без раздела · 45% бюджета', '620 ₾', '0 из 620 ₾ · лимит ≈ 20.67 ₾ в день']));
    const nov = await (await getDb()).get<{ b: number; l: number; p: number }>("SELECT budget_minor AS b, locked_minor AS l, unplanned_pct AS p FROM plan_months WHERE ym = '2026-11'");
    expect(nov).toMatchObject({ b: 300000, l: 30000, p: 10 });
    expect(await item('Продукты', '2026-11')).toMatchObject({ a: 62000, kind: 'limit' });
  });

  test('budget sheet opens in the currency carried from the previous month', async () => {
    await openApp(planned);
    const db = await getDb();
    await db.run("UPDATE plan_months SET budget_currency = 'USD' WHERE ym = '2026-10'");
    await tap('Статистика');
    await openNextMonth();
    // November: the sheet's initial currency comes from planCurrency('2026-11'), carried from October
    await openBudget();
    expect(await screen.findByLabelText('Валюта: Доллар США')).toBeTruthy();
  });
});

test('6.3.10 a limit given to a category planned last month only: last month\'s amount in this one, no plan\'s sheet', async () => {
  await openApp(async () => {
    await planned();
    const db = await getDb();
    const { id } = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Такси'"))!;
    await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency, norm_period) VALUES ('2026-09', ?, 15000, 'limit', 'GEL', 'week')", [id]);
  });
  await openMenu('Категории');
  await tap('🚕 Такси');
  await tap(await screen.findByText('Траты с лимитом'));
  await tap('Сохранить');
  expect(await screen.findByText('«🚕 Такси»: вид в плане сохранён')).toBeTruthy();
  expect(screen.queryByText('‹ Назад')).toBeNull();
  await waitFor(async () => expect(await item('Такси')).toMatchObject({ a: 15000, kind: 'limit', norm: 'week' }));
});
