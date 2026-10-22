// 6.6 "Итоги месяца": the sheet step by step — Перерасход → Сбережения ("Сколько удалось отложить?" laid out over the
// funds, 🔒 and 💰), "Далее" once answered, "‹ Назад",
// "Подвести позже" (the answers kept), "Отчёт за сентябрь" closes the month. Today: 15 October 2026; the seed's September:
// a budget of 3 000 ₾, 1 850 ₾ spent.
import { act, waitFor } from '@testing-library/react-native';
import { getSetting } from '../../src/db/settings';
import { openApp, screen, tap, texts } from './app';
import { buy, category, on, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { answerClose, finishClose, setFund, setPlanBudget, setSplit } from '../../src/db/plans';
import { openMonthClose } from '../../src/shared/navigation/sheets';

const m = (s: string) => s.replace(/ /g, ' ');
const disabled = (title: string) => !!screen.getByRole('button', { name: title }).props.accessibilityState?.disabled;
const closedAt = async () => (await (await getDb()).get<{ c: number | null }>("SELECT closed_at AS c FROM month_closes WHERE ym = '2026-09'"))?.c ?? null;

async function open() {
  act(() => openMonthClose('2026-09'));
  expect(await screen.findByText('Итоги · Сентябрь 2026')).toBeTruthy();
}

describe('6.6 month close', () => {
  test('no overspend: what the budget left, "Сколько удалось отложить?", how it is laid out; "Отчёт за сентябрь" closes it', async () => {
    await openApp(planned);
    await open();
    expect(screen.getByText('Шаг 1 из 1 · Сбережения')).toBeTruthy();
    expect(screen.getByText('Осталось от бюджета')).toBeTruthy();
    expect(screen.getByText('Сколько удалось отложить?')).toBeTruthy();
    expect(screen.getByText('Разложим так')).toBeTruthy();
    expect(screen.getByText('💰 Сэкономлено')).toBeTruthy();
    expect(screen.getByText(/Перенести на октябрь$/)).toBeTruthy();
    expect(screen.getByText('Отчёт откроется, когда ответите на вопросы выше')).toBeTruthy();
    expect(disabled('Отчёт за сентябрь')).toBe(true);

    await tap(m('Да, 1 150 ₾'));
    expect(await screen.findByText(m('✓ Отложено 1 150 ₾'))).toBeTruthy();
    expect(screen.getByText('Разложили')).toBeTruthy();
    expect(disabled('Отчёт за сентябрь')).toBe(false);
    await tap('Отчёт за сентябрь');
    expect(await screen.findByText('Отчёт · Сентябрь 2026')).toBeTruthy();
    expect(await closedAt()).not.toBeNull();
  });

  test('a fund, an overspend bigger than 🔒: the overspend, then one sum laid out — the fund first; by hand; "Назад", "Подвести позже" keeps the answers', async () => {
    await openApp(async () => {
      await planned();
      const holiday = await category('Отпуск', '🏖');
      const taxi = await category('Такси', '🚕');
      await setPlanBudget('2026-09', 300000, 'GEL', 0, true, 50000);
      await setFund('2026-09', holiday, { target_minor: 150000, currency: 'GEL', due: '2027-01-31', start_minor: 0 }, '2026-09');
      await buy('BOLT', 1500, on(20, 12, 1), taxi);
    });
    await open();
    // 3 350 spent and the fund's 300, 2 500 for spending: 1 150 over, 🔒 500 covers part of it
    expect(screen.getByText('Шаг 1 из 2 · Перерасход')).toBeTruthy();
    expect(screen.getByText(m('Из сбережений сентября — 500 ₾ из 1 150 ₾'))).toBeTruthy();
    expect(screen.getByText(m('Остальные 650 ₾?'))).toBeTruthy();
    await tap(m('Из бюджета октября — все 1 150 ₾'));
    await tap('Далее');

    // 🔒 kept whole: the fund's 300 and 🔒 500 asked
    expect(await screen.findByText('Шаг 2 из 2 · Сбережения')).toBeTruthy();
    expect(screen.getByText(m('Да, 800 ₾'))).toBeTruthy();
    await tap('Другая сумма');
    act(() => { screen.getByLabelText('Отложено').props.onChangeText('400'); });
    await tap('Готово');
    expect(await screen.findByText(m('✓ Отложено 400 ₾'))).toBeTruthy();
    // the fund first, 🔒 the rest
    expect(screen.getByText(m('300 ₾ ✓'))).toBeTruthy();
    expect(screen.getByText(m('из 500 ₾'))).toBeTruthy();

    await tap('Изменить распределение ›');
    expect(await screen.findByText('Распределение · сентябрь')).toBeTruthy();
    act(() => { screen.getByLabelText('Отложено в «🏖 Отпуск»').props.onChangeText('100'); });
    await tap('Сохранить');
    await waitFor(async () => expect(await (await getDb()).get("SELECT saved_minor FROM fund_confirms WHERE ym = '2026-09'")).toEqual({ saved_minor: 10000 }));
    expect(await screen.findByText(/^не хватило 200/)).toBeTruthy();

    await tap('‹ Назад');
    expect(await screen.findByText('Шаг 1 из 2 · Перерасход')).toBeTruthy();
    await tap('Подвести позже');
    expect(await closedAt()).toBeNull();
    expect(await (await getDb()).get("SELECT over_cover, saved, saved_minor FROM month_closes WHERE ym = '2026-09'"))
      .toEqual({ over_cover: 'next', saved: 'other', saved_minor: 40000 });
  });
  test('October\'s plan: September\'s leftover moved in — a line under the budget, "Перенос из сентября"; a tap — "Куда остаток?"', async () => {
    await openApp(async () => {
      await planned();
      await answerClose('2026-09', { rest_choice: 'next' });
      await finishClose('2026-09');
    });
    await tap('Статистика');
    await tap('План');
    expect(await screen.findByText(m('4 150 ₾'))).toBeTruthy();
    expect(screen.getByText(m('3 000 ₾ + 1 150 ₾ из сентября'))).toBeTruthy();
    expect(screen.getByText('Перенос из сентября')).toBeTruthy();
    expect(screen.getAllByText(m('+1 150 ₾')).length).toBeGreaterThan(0);
    await tap('Изменить: ➕ Остаток сентября');
    expect(await screen.findByText('Куда остаток?')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Перенести на октябрь' }).props.accessibilityState).toMatchObject({ checked: true });
    await tap('В сбережения');
    await tap('Сохранить');
    // to savings: what was put aside is asked — September's "Итоги" open
    expect(await screen.findByText('Итоги · Сентябрь 2026')).toBeTruthy();
    await tap('Подвести позже');
    expect(await screen.findByText(m('3 000 ₾'))).toBeTruthy();
    expect(screen.queryByText('Перенос из сентября')).toBeNull();
  });

  test('October\'s plan: September\'s overspend owed — red first in the bar, its row; "Покрыть иначе?" → "Уже покрыт"', async () => {
    await openApp(async () => {
      await planned();
      await buy('BOLT', 1500, on(20, 12, 1), await category('Такси', '🚕'));
      await answerClose('2026-09', { over_cover: 'next' });
      await finishClose('2026-09');
    });
    await tap('Статистика');
    await tap('План');
    expect(await screen.findByText('Перерасход сентября')).toBeTruthy();
    expect(screen.getByText('⚠️ Перерасход сентября')).toBeTruthy();
    expect(screen.getByText(/^вычтен из бюджета октября/)).toBeTruthy();
    await tap('Изменить: ⚠️ Перерасход сентября');
    expect(await screen.findByText('Покрыть иначе?')).toBeTruthy();
    // no 🔒 in September: not from its savings
    expect(screen.queryByText('Из сбережений сентября')).toBeNull();
    await tap('Уже покрыт');
    await tap('Сохранить');
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.queryByText('⚠️ Перерасход сентября')).toBeNull();
  });
  test('«История»: "Итоги не подведены" — "Подвести итоги ›" opens them; closed — the leftover as answered, "Изменить итоги ›"', async () => {
    await openApp(planned);
    await tap('Статистика');
    await tap('История');
    expect(await screen.findByText('Итоги не подведены: удалось ли отложить, взносы в копилки')).toBeTruthy();
    expect(screen.getByText(m('1 150 ₾ ?'))).toBeTruthy();
    await tap('Подвести итоги ›');
    expect(await screen.findByText('Итоги · Сентябрь 2026')).toBeTruthy();
    await tap(/Перенести на октябрь$/);
    await tap('Отчёт за сентябрь');
    expect(await screen.findByText('Отчёт · Сентябрь 2026')).toBeTruthy();
    expect(await closedAt()).not.toBeNull();
    // the report over the History: closed under it
    expect(await screen.findByText('Изменить итоги ›')).toBeTruthy();
    expect(screen.queryByText('Итоги не подведены: удалось ли отложить, взносы в копилки')).toBeNull();
    expect(screen.getAllByText('Перенесено').length).toBeGreaterThan(0);
  });
  test('the report after the "Итоги": what was put aside on top, "по плану"; each row\'s plan and fact, the fund\'s too', async () => {
    await openApp(async () => {
      await planned();
      const holiday = await category('Отпуск', '🏖');
      await setFund('2026-09', holiday, { target_minor: 150000, currency: 'GEL', due: '2027-01-31', start_minor: 0 }, '2026-09');
      await answerClose('2026-09', { rest_choice: 'savings', saved: 'other', saved_minor: 50000 });
      // by hand: the fund 200, the rest to savings
      await setSplit('2026-09', [{ category_id: holiday, minor: 20000 }]);
      await finishClose('2026-09');
    });
    await tap('Статистика');
    await tap('История');
    await tap('Отчёт за месяц ›');
    expect(await screen.findByText('Отчёт · Сентябрь 2026')).toBeTruthy();
    // 3 000 − 1 850 spent: 1 150 — 850 left and the fund's 300, as planned; 500 put aside: the fund 200, 💰 300
    // the amounts here are shown masked-ready: compared with plain spaces
    const t = texts().map((x) => x.replace(/\s/g, ' '));
    const after = (label: string, n: number) => t.slice(t.indexOf(label) + 1, t.indexOf(label) + 1 + n);
    expect(after('Отложено', 1)).toEqual(['500 ₾']);
    expect(after('💰 Сэкономлено', 2)).toEqual(['850 ₾', '300 ₾']);
    expect(after('🏖 Отпуск · взнос', 2)).toEqual(['300 ₾', '200 ₾']);
    expect(after('Всего', 2)).toEqual(['1 150 ₾', '500 ₾']);
    expect(screen.queryByText('Итоги не подведены: факт появится, когда ответите, что удалось отложить')).toBeNull();
  });
  describe('the banner, the 1st to the 3rd', () => {
    // the screens' "today" (15 October) moved on: setup.ts counts it from the real clock
    const Real = Object.getPrototypeOf(Date) as DateConstructor;
    const realNow = Real.now;
    let spy: jest.SpyInstance | null = null;
    const onDay = (day: number) => { spy = jest.spyOn(Real, 'now').mockImplementation(() => realNow.call(Real) + (day + 31 - 15) * 86400000); };
    afterEach(() => spy?.mockRestore());

    test('2 November: "Сентябрь не закрыт" (the oldest) over every section; ✕ — till tomorrow; "Подвести итоги ›" opens them', async () => {
      onDay(2);
      await openApp(planned);
      await tap('Статистика');
      expect(await screen.findByText('Сентябрь не закрыт')).toBeTruthy();
      await tap('История');
      expect(await screen.findByText('Сентябрь не закрыт')).toBeTruthy();
      await tap('Подвести итоги ›');
      expect(await screen.findByText('Итоги · Сентябрь 2026')).toBeTruthy();
      await tap('Подвести позже');
      await tap('Скрыть до завтра');
      await waitFor(() => expect(screen.queryByText('Сентябрь не закрыт')).toBeNull());
      expect(await getSetting('close_banner_hidden')).toBe('2026-11-02');
    });

    test('4 November: no banner — only «История» offers them', async () => {
      onDay(4);
      await openApp(planned);
      await tap('Статистика');
      await tap('История');
      // (the seed's "this month" lands in November: September is the one over with a plan)
      expect(await screen.findAllByText('Итоги не подведены: удалось ли отложить, взносы в копилки')).toHaveLength(1);
      expect(screen.queryByText('Сентябрь не закрыт')).toBeNull();
    });
  });

  test('"Остаток": August\'s balance plus what September would save, edited down', async () => {
    await openApp(async () => {
      await planned();
      await (await getDb()).run(
        "INSERT INTO month_closes (ym, by_balance, balance_minor, carry_currency, closed_at) VALUES ('2026-08', 1, 120000, 'GEL', 1)");
    });
    await open();
    await tap('Остаток');
    const field = await screen.findByLabelText('Остаток на счёте');
    expect(field.props.value).toBe('2350');
    expect(screen.getByText(m('В августе было 1 200 ₾, по бюджету +1 150 ₾ — по расчёту 2 350 ₾.'))).toBeTruthy();
    expect(screen.getByText(m('За сентябрь +1 150 ₾'))).toBeTruthy();
    act(() => { field.props.onChangeText('2300'); field.props.onBlur(); });
    expect(await screen.findByText(m('За сентябрь +1 100 ₾'))).toBeTruthy();
    expect(screen.getByText(m('На 50 ₾ меньше расчёта'))).toBeTruthy();
    expect(screen.getByText(m('+1 100 ₾'))).toBeTruthy();
    expect(screen.getByText(m('1 100 ₾'))).toBeTruthy();
    expect(disabled('Отчёт за сентябрь')).toBe(false);
  });

  test('the first "Остаток": "В августе было" once, then the account opens on it plus what to save', async () => {
    await openApp(planned);
    await open();
    await tap('Остаток');
    expect(await screen.findByText('Прошлого остатка нет — его нужно ввести один раз.')).toBeTruthy();
    const was = screen.getByLabelText('В августе было');
    act(() => { was.props.onChangeText('1200'); was.props.onBlur(); });
    expect((await screen.findByLabelText('Остаток на счёте')).props.value).toBe('2350');
    expect(screen.queryByText('Прошлого остатка нет — его нужно ввести один раз.')).toBeNull();
  });
});
