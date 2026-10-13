// 6.5 "Копилки": a category saved up for — made from the plan's sheet, its card, the stats, deleted. Today: 15 October
// 2026; the seed's budget 3 000 ₾, Одежда planned 400 ₾ and ZARA 450 ₾ spent in it.
import { fireEvent } from '@testing-library/react-native';
import { openApp, screen, tap } from './app';
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
  test('made from the plan\'s sheet: its contribution in "Копилки", what it has of the target', async () => {
    await makeFund();
    expect(await fund()).toEqual({ target_minor: 150000, due: '2027-01-31', start_minor: 30000, closed_ym: null });
    // saved 300 + October's 300 − ZARA 450
    expect(await screen.findByText(`150 из 1 500${N}₾ · к 31 января 2027`)).toBeTruthy();
    // the budget's column and the section
    expect(screen.getAllByText('Копилки')).toHaveLength(2);
    expect(screen.getByText('в месяц')).toBeTruthy();
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

  test('the stats: its spending apart, "Из копилок … — не из бюджета месяца"', async () => {
    await openApp(async () => {
      await planned();
      const { id } = (await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'"))!;
      await setFund('2026-10', id, { target_minor: 150000, currency: 'GEL', due: '2027-01-31', start_minor: 30000 });
    });
    await tap('Статистика');
    expect(await screen.findByText(`Из копилок 450${N}₾ — не из бюджета месяца`)).toBeTruthy();
    expect(screen.getByText(`в копилке 150${N}₾`)).toBeTruthy();
  });
});
