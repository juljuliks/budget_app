// 6.5 "Копилки": a category saved up for — made from the plan's sheet, its card, the stats, deleted. Today: 15 October
// 2026; the seed's budget 3 000 ₾, Одежда planned 400 ₾ and ZARA 450 ₾ spent in it.
import { fireEvent } from '@testing-library/react-native';
import { backToTabs, openApp, screen, tap, texts } from './app';
import { planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { setFund } from '../../src/db/plans';

const N = ' ';
const fund = async () => (await getDb()).get<{ target_minor: number; due: string; start_minor: number; closed_ym: string | null }>(
  "SELECT f.target_minor, f.due, f.start_minor, f.closed_ym FROM funds f JOIN categories c ON c.id = f.category_id WHERE c.name = 'Одежда'");

async function makeFund() {
  await openApp(planned);
  await tap('Статистика');
  await tap('План');
  await tap('Изменить: 👕 Одежда');
  await tap('Копилка');
  expect(await screen.findByText('Накопить')).toBeTruthy();
  expect(screen.getByText('Не выбрана')).toBeTruthy();
  expect(screen.getByText('Выберите дату — посчитаем взнос в месяц')).toBeTruthy();
  fireEvent.changeText(screen.getByDisplayValue('400'), '1500');
  fireEvent.changeText(screen.getByLabelText('Уже отложено'), '300');
  await tap('Выбрать дату');
  // the calendar opens on the next month: two on is January
  await tap('›');
  await tap('›');
  await tap('#day-2027-01-31');
  await tap('Выбрать');
  expect(await screen.findByText(`300${N}₾ в месяц · 4 месяца`)).toBeTruthy();
  expect(screen.getByText(/^31 января 2027/)).toBeTruthy();
  await tap('Сохранить');
  expect(await screen.findByText('Копилка «👕 Одежда» сохранена')).toBeTruthy();
}

describe('6.5 funds', () => {
  test('made from the plan\'s sheet: its contribution in "Сбережения", what it has of the target', async () => {
    await makeFund();
    expect(await fund()).toEqual({ target_minor: 150000, due: '2027-01-31', start_minor: 30000, closed_ym: null });
    // saved 300 + October's 300 − ZARA 450
    expect(await screen.findByText(`150 из 1 500${N}₾ · к 31 января 2027`)).toBeTruthy();
    // no column or section of its own: in "Сбережения"
    expect(screen.queryByText('Копилки')).toBeNull();
    expect(screen.getAllByText('Сбережения').length).toBeGreaterThanOrEqual(2);
    // the share alone: the plan is the month's anyway; this month its contribution still goes
    const t = texts();
    const i = t.indexOf('👕 Одежда');
    expect(t[i + 2]).toBe('✓ взнос выходит');
    expect(t[i + 3]).toMatch(/^300\s₾$/);
    expect(t[i + 4]).toBe('10%');
  });

  test('the screen in another currency: the contribution in the fund\'s own one before it, "(300 ₾)"', async () => {
    await makeFund();
    const db = await getDb();
    for (let d = 1; d <= 15; d++) await db.run("INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, 'USD', 2.5)", [`2026-10-${String(d).padStart(2, '0')}`]);
    await tap('Настройки');
    await tap('$ USD');
    backToTabs();
    await screen.findAllByText('120 $');
    const t = texts();
    const i = t.indexOf('👕 Одежда');
    expect(t.slice(i + 1, i + 6)).toEqual(['150 из 1 500 ₾ · к 31 января 2027', '✓ взнос выходит', '(300 ₾)', '120 $', '10%']);
  });

  test('a contribution past what is free, 🔒 has it: "Вычесть из сбережений?" — what is short taken from it', async () => {
    await openApp(planned);
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 👕 Одежда');
    await tap('Копилка');
    // 2 700 over 4 months: 675 a month, 640 free
    fireEvent.changeText(await screen.findByDisplayValue('400'), '2700');
    await tap('Выбрать дату');
    await tap('›');
    await tap('›');
    await tap('#day-2027-01-31');
    await tap('Выбрать');
    await tap('Сохранить');
    expect(await screen.findByText(`Свободного не хватает 35${N}₾ — их можно взять из сбережений.`)).toBeTruthy();
    await tap('Вычесть и сохранить');
    expect(await screen.findByText(`Копилка «👕 Одежда» сохранена, из 🔒 вычтено 35${N}₾`)).toBeTruthy();
    expect(await fund()).toMatchObject({ target_minor: 270000 });
    expect(await (await getDb()).get("SELECT locked_minor AS l FROM plan_months WHERE ym = '2026-10'")).toEqual({ l: 26500 });
  });

  test('its card: what it has, the contributions and the spending; deleted — asked, "Отменить" brings it back', async () => {
    await makeFund();
    await tap('Копилка: 👕 Одежда');
    expect(await screen.findByText(`из 1 500${N}₾`)).toBeTruthy();
    expect(screen.getByText('К 31 января 2027 · ещё 3 взноса')).toBeTruthy();
    expect(screen.getByText('Октябрь · ZARA')).toBeTruthy();
    expect(screen.getByText('Октябрь · взнос, идёт')).toBeTruthy();
    expect(screen.getByText('Октябрь · уже отложено')).toBeTruthy();
    await tap('Удалить копилку');
    expect(await screen.findByText('Удалить копилку «👕 Одежда»?')).toBeTruthy();
    expect(screen.getByText(`Накоплено 150${N}₾ — они перейдут в сбережения октября. Категория останется, её траты пойдут вне плана, пока вы не добавите её в план снова.`)).toBeTruthy();
    await tap('Удалить');
    expect(await screen.findByText('Копилка «👕 Одежда» удалена')).toBeTruthy();
    expect(await fund()).toMatchObject({ closed_ym: '2026-10' });
    await tap('Отменить');
    expect(await screen.findByText('Копилка «👕 Одежда» снова в плане')).toBeTruthy();
    expect(await fund()).toMatchObject({ closed_ym: null });
  });

  test('the stats: a fund spent from — its spending apart, "Из копилок … — не из бюджета месяца"; one not spent from — not there', async () => {
    await openApp(async () => {
      await planned();
      const db = await getDb();
      const { id } = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'"))!;
      await setFund('2026-10', id, { target_minor: 150000, currency: 'GEL', due: '2027-01-31', start_minor: 30000 });
      const subs = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Подписки'"))!.id;
      await setFund('2026-10', subs, { target_minor: 12000, currency: 'GEL', due: '2027-03-31', start_minor: 0 });
    });
    await tap('Статистика');
    expect(await screen.findByText(`Из копилок 450${N}₾ — не из бюджета месяца`)).toBeTruthy();
    // in «Сбережения» (its contribution) and in "Копилки" (spent from it)
    expect(screen.getAllByText('👕 Одежда')).toHaveLength(2);
    expect(screen.queryByText(/^в копилке/)).toBeNull();
    // what is put in a fund is saving: a fund nothing was spent from is in «Сбережения» only
    expect(screen.getAllByText('📺 Подписки')).toHaveLength(1);
  });
});
