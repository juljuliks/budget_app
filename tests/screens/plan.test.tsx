// 6: the plan — the month's budget (what's locked, the share outside the plan, the leftover to savings), the
// categories in it, adding them, the next month. Today: 15 October 2026.
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { openApp, screen, tap, texts, backToTabs, toggleSwitch } from './app';
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
    expect(after('План', 2)).toEqual(['17%', '500 ₾']);
  });

  test('the split: the plan, outside it, savings; the savings and the share as sections', async () => {
    await openPlan();
    expect(after('План', 2)).toEqual(['72%', '2 160 ₾']);
    expect(after('Вне плана', 2)).toEqual(['10%', '300 ₾']);
    // the overspend took 130 of them (see the next test): what is left, by how much
    expect(after('Сбережения', 4)).toEqual(['14%', '(−130 ₾', ')', '410 ₾']);
    expect(after('🔒 Отложено сразу', 3)).toEqual(['заблокировано в начале месяца', '300 ₾', '10%']);
    expect(after('💰 Сэкономлено', 4)).toEqual(['перерасход: ', '−130 ₾', '110 ₾', '4%']);
    expect(after('🎲 Траты вне плана', 3)).toEqual(['категории без плана и без категории', '300 ₾', '10%']);
  });

  test('another currency: the savings in it, "(N ₾)" before them in the budget\'s one', async () => {
    await openPlan();
    const db = await getDb();
    for (let d = 1; d <= 15; d++) await db.run("INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, 'USD', 2.5)", [`2026-10-${String(d).padStart(2, '0')}`]);
    await tap('Настройки');
    await tap('$ USD');
    backToTabs();
    expect(await screen.findByText('(300 ₾)')).toBeTruthy();
    expect(after('🔒 Отложено сразу', 4)).toEqual(['заблокировано в начале месяца', '(300 ₾)', '120 $', '10%']);
    expect(after('💰 Сэкономлено', 5)).toEqual(['перерасход: ', '−52 $', '(110 ₾)', '44 $', '4%']);
    // the section's header: its total in the budget's currency first
    expect(screen.getByText('(410 ₾) ')).toBeTruthy();
  });

  test('savings the overspend took part of: a tap on its line — by how much, what took it; a category\'s tap opens its plan', async () => {
    await openPlan();
    expect(screen.queryByText(/^Сбережения к концу месяца/)).toBeNull();
    // the savings section's line: ⓘ in its "перерасход: −130 ₾ ⓘ"
    await tap('Почему сбережения меньше');
    expect(await screen.findByText('Сбережения меньше на 130 ₾')).toBeTruthy();
    await tap('Понятно');
    // the legend's line: a tap on it
    await tap('Сбережения: почему меньше');
    // 3 000 − (620 + 310 + 800 + 450 + 30) − 380 outside the plan
    expect(await screen.findByText('Сбережения меньше на 130 ₾')).toBeTruthy();
    expect(screen.getByText('Эти категории потратили больше плана. Если дальше тратить по плану, в сбережения пойдёт 410 ₾ (−130 ₾)')).toBeTruthy();
    expect(screen.getByText('доля 300 ₾ · потрачено 380 ₾')).toBeTruthy();
    expect(screen.getByText('план 400 ₾ · потрачено 450 ₾')).toBeTruthy();
    await tap('План: Одежда');
    expect(await screen.findByDisplayValue('400')).toBeTruthy();
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

  test('"MAX": all that the plan and the other part leave, as an amount; typed by hand — an amount again', async () => {
    await tap('Изменить бюджет месяца');
    await screen.findByText('300 ₾ сразу в сбережения: план и траты вне плана их не займут.');
    const [lockedMax] = screen.getAllByRole('tab', { name: 'MAX' });
    await tap(lockedMax);
    // 3 000 − 2 160 planned − 300 the share outside the plan
    expect(await screen.findByDisplayValue('540')).toBeTruthy();
    // nothing left for the share outside the plan to grow into
    expect(screen.getAllByRole('tab', { name: 'MAX' })[1].props.accessibilityState).toMatchObject({ disabled: true });
    await tap('Сохранить');
    expect(await screen.findByText('Бюджет месяца сохранён')).toBeTruthy();
    expect(await month()).toMatchObject({ l: 54000 });
  });

  test('all that is free opens as "MAX"', async () => {
    await (await getDb()).run("UPDATE plan_months SET locked_minor = 54000 WHERE ym = '2026-10'");
    await tap('История');
    await tap('План');
    await tap('Изменить бюджет месяца');
    await screen.findByDisplayValue('540');
    await waitFor(() => expect(screen.getAllByRole('tab', { name: 'MAX' })[0].props.accessibilityState).toMatchObject({ selected: true }));
  });

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
    await waitFor(() => expect(screen.queryByText('🔒 Отложено сразу')).toBeNull());
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

  test('the leftover: always in "Сбережения" — where it goes is asked in "Итоги месяца", no switch in the budget', async () => {
    await tap('Изменить бюджет месяца');
    await screen.findByText('На траты вне плана');
    expect(screen.queryByText('Что останется — в сбережения')).toBeNull();
    expect(screen.queryByText('Свободно')).toBeNull();
  });
});

describe('6.3 the categories in the plan', () => {
  beforeEach(() => openPlan());

  test('a row: its limit per rhythm, its share of the budget; the obligatory ones', async () => {
    expect(after('🛒 Продукты', 3)).toEqual(['лимит ≈ 20 ₾ в день', '620 ₾', '21%']);
    expect(after('☕️ Кафе и рестораны', 3)).toEqual(['лимит ≈ 70 ₾ в неделю', '310 ₾', '10%']);
    expect(after('🏠 Дом и коммуналка', 3)).toEqual(['разовый платёж', '800 ₾', '27%']);
    expect(after('👕 Одежда', 3)).toEqual(['крупно, раз в месяц', '400 ₾', '13%']);
  });

  test('an amount: what helps to pick it; more than is free refused; saved', async () => {
    await tap('Изменить: 🛒 Продукты');
    expect(await screen.findByText('Можно запланировать')).toBeTruthy();
    expect(after('Можно запланировать', 1)).toEqual(['до 860 ₾']);
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
    await tap('Изменить: 🛒 Продукты');
    await tap('Открыть: 🛒 Продукты');
    expect(await screen.findByDisplayValue('Продукты')).toBeTruthy();
    // the repeating payments are turned on and off in the plan only
    expect(screen.queryByText('Регулярные платежи')).toBeNull();
  });

  test('"Повторять каждый месяц" in the sheet: the badge on its icon; removing such a one asks', async () => {
    expect(screen.queryByLabelText('повторяется каждый месяц')).toBeNull();
    await tap('Изменить: 👕 Одежда');
    expect(await screen.findByText('В ноябре перейдёт без суммы')).toBeTruthy();
    expect(screen.queryByText('Дата окончания (необязательно)')).toBeNull();
    toggleSwitch(true);
    expect(await screen.findByText(/^В ноябре будет в плане с той же суммой — /)).toBeTruthy();
    // repeated: till an end, if it has one
    expect(screen.getByText('Дата окончания (необязательно)')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('План «👕 Одежда» сохранён')).toBeTruthy();
    expect(await screen.findByLabelText('повторяется каждый месяц')).toBeTruthy();
    expect((await (await getDb()).get<{ pinned: number }>("SELECT p.pinned FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = '2026-10' AND c.name = 'Одежда'"))!.pinned).toBe(1);
    await tap('Изменить: 👕 Одежда');
    await tap('Удалить из плана');
    expect(await screen.findByText(/^Убрать «.*» из плана\?$/)).toBeTruthy();
    expect(screen.getByText('Эта категория повторяется каждый месяц. Она пропадёт из плана этого месяца и не перейдёт в следующие. Операции не изменятся.')).toBeTruthy();
    await tap('Убрать из плана');
    expect(await screen.findByText(/^«.*» убрана из плана$/)).toBeTruthy();
    expect(await item('Одежда')).toBeUndefined();
  });

  test('a regular payment within the month: every week on Mondays and Thursdays — the times by the amount; not repeated — this month only', async () => {
    await tap('Изменить: 👕 Одежда');
    await tap(await screen.findByRole('radio', { name: /Регулярный платёж/ }));
    await tap('Каждую неделю');
    expect(await screen.findByText('Выберите дни недели')).toBeTruthy();
    expect(screen.getByText('Сумма за раз')).toBeTruthy();
    await tap('пн');
    await tap('чт');
    fireEvent.changeText(screen.getByDisplayValue('400'), '20');
    // October: 4 Mondays, 5 Thursdays
    expect(await screen.findByText('9 раз в октябре — 180\u00a0₾')).toBeTruthy();
    expect(screen.getByText('Только в этом месяце')).toBeTruthy();
    expect(screen.getByText('Дата окончания (необязательно)')).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('План «👕 Одежда» сохранён')).toBeTruthy();
    expect(await screen.findByText('пн, чт · 9 × 20\u00a0₾')).toBeTruthy();
    expect(await (await getDb()).get("SELECT p.limit_minor AS a, p.kind, p.every, p.weekdays, p.unit_minor AS u FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = '2026-10' AND c.name = 'Одежда'"))
      .toEqual({ a: 18000, kind: 'fixed', every: 'week', weekdays: 9, u: 2000 });
    // its sheet again: the same, the amount each time
    await tap('Изменить: 👕 Одежда');
    expect(await screen.findByRole('radio', { name: /Регулярный платёж/, checked: true })).toBeTruthy();
    expect(screen.getByDisplayValue('20')).toBeTruthy();
    expect(screen.getByText('9 раз в октябре — 180\u00a0₾')).toBeTruthy();
  });

  test('"Что значат значки": the plan icons sheet', async () => {
    await tap('Что значат значки');
    for (const t of ['Значки плана', 'Траты с лимитом', 'Разовый платёж', 'Регулярный платёж', 'Повторять каждый месяц', 'Копилка', 'Часть бюджета']) {
      expect(await screen.findByText(t)).toBeTruthy();
    }
    await tap('Понятно');
    await waitFor(() => expect(screen.queryByText('Значки плана')).toBeNull());
  });

  test('removing one not repeated: at once; "Отменить" brings it back as it was', async () => {
    const before = await item('Одежда');
    await tap('Изменить: 👕 Одежда');
    await tap('Удалить из плана');
    expect(await screen.findByText('«👕 Одежда» убрана из плана')).toBeTruthy();
    expect(await item('Одежда')).toBeUndefined();
    await tap('Отменить');
    expect(await screen.findByText('«👕 Одежда» снова в плане')).toBeTruthy();
    expect(await item('Одежда')).toEqual(before);
    expect(await screen.findByLabelText('Изменить: 👕 Одежда')).toBeTruthy();
  });

  test('more than is free, 🔒 has it: "Вычесть из сбережений?" — what is short taken from it', async () => {
    await tap('Изменить: 👕 Одежда');
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
    await tap('Изменить: 👕 Одежда');
    fireEvent.changeText(await screen.findByDisplayValue('400'), '700');
    await tap('Сохранить');
    await screen.findByText('Вычесть из сбережений?');
    await tap('Отмена');
    expect(await screen.findByDisplayValue('700')).toBeTruthy();
    expect(await item('Одежда')).toMatchObject({ a: 40000 });
    expect(await month()).toMatchObject({ l: 30000 });
  });
});

describe('6.3.2 adding to the plan, step by step', () => {
  beforeEach(() => openPlan());

  test('step 1: the month before\'s plan, then spent in this month, then the rest; none in the plan or system', async () => {
    // Кафе out of this month's plan: it was in September's
    await (await getDb()).run("DELETE FROM plan_items WHERE ym = '2026-10' AND category_id = (SELECT id FROM categories WHERE name = 'Кафе и рестораны')");
    await tap('История');
    await tap('План');
    await tap('Добавить в план');
    expect(await screen.findByText('Шаг 1 из 2 · Категория')).toBeTruthy();
    expect(screen.getByText('Свободно: 550 ₾ · траты — за октябрь')).toBeTruthy();
    const t = texts();
    const at = (s: string) => t.indexOf(s);
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
