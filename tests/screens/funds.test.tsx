// 6.5 "Копилки": a category saved up for — made on its page, its card, the stats, turned off. Today: 15 October
// 2026; the seed's budget 3 000 ₾, Одежда planned 400 ₾ and ZARA 450 ₾ spent in it.
import { fireEvent } from '@testing-library/react-native';
import { backToTabs, openApp, screen, tap, texts, pressAction, openMenu } from './app';
import { planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { setFund, setPlanBudget } from '../../src/db/plans';

const N = ' ';
const fund = async () =>
  (await getDb()).get<{ target_minor: number; due: string; start_minor: number; closed_ym: string | null }>(
    "SELECT f.target_minor, f.due, f.start_minor, f.closed_ym FROM funds f JOIN categories c ON c.id = f.category_id WHERE c.name = 'Одежда'",
  );

/** The category's page: «В плане» — «Копилка», «Настроить»: how much and «Уже отложено», by 31 January 2027 (the calendar to its month). */
async function fillFund(target: string, start = '') {
  await openMenu('Категории');
  await tap('👕 Одежда');
  await screen.findByText(/^Копить на нечастую трату/);
  await tap('Копилка');
  await tap('Настроить');
  expect(await screen.findByText('Выберите дату — посчитаем взнос в месяц')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Сколько накопить'), target);
  if (start) fireEvent.changeText(screen.getByLabelText('Уже отложено'), start);
  await tap('Выбрать дату');
  for (let n = 0; n < 6 && !screen.queryByTestId('day-2027-01-31'); n++) await tap('›');
  await tap('#day-2027-01-31');
  await tap('Выбрать');
}

async function makeFund() {
  await openApp(planned);
  await fillFund('1500', '300');
  expect(await screen.findByText(`300${N}₾ в месяц · 4 месяца`)).toBeTruthy();
  expect(screen.getByText(/^31 января 2027/)).toBeTruthy();
  await tap('Сохранить копилку');
  expect(await screen.findByText('Копилка «👕 Одежда» сохранена')).toBeTruthy();
  expect(await screen.findByText('Копилка: взносы и траты ›')).toBeTruthy();
  expect(screen.getByText(`1 500${N}₾ к 31 января 2027`)).toBeTruthy();
  backToTabs();
  await tap('Статистика');
  await screen.findByLabelText('Добавить в план');
}

describe('6.5 funds', () => {
  test('made on its category\'s page: its contribution in "Сбережения", what it has of the target; no «Импульсивные покупки»', async () => {
    await makeFund();
    expect(await fund()).toEqual({ target_minor: 150000, due: '2027-01-31', start_minor: 30000, closed_ym: null });
    // saved 300 + October's 300 − ZARA 450
    expect(await screen.findByText(`взнос в копилку · 150 из 1 500${N}₾ · к 31 января 2027`)).toBeTruthy();
    // no section of its own: in "Сбережения"
    expect(screen.queryByText('Копилки')).toBeNull();
    const t = texts();
    const i = t.lastIndexOf('👕 Одежда');
    expect(t[i + 1]).toBe('300 / 300 ₾ · 100%');
    // the plan's sheet picks no kind: it is the category's (none set — a one-off payment)
    await tap('Добавить в план');
    await tap('Добавить в план: 🚕 Такси');
    expect(await screen.findByText('Изменить в категории ›')).toBeTruthy();
    expect(screen.getByText('Разовый платёж')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Копилка/ })).toBeNull();
  });

  test('its page with the fund: no «Импульсивные покупки» at all', async () => {
    await makeFund();
    backToTabs();
    await openMenu('Категории');
    await tap('👕 Одежда');
    expect(await screen.findByText('Копилка: взносы и траты ›')).toBeTruthy();
    expect(screen.queryByText('Импульсивные покупки')).toBeNull();
  });

  test("the screen in another currency: the contribution in the fund's own currency, the display one not shown", async () => {
    await makeFund();
    const db = await getDb();
    for (let d = 1; d <= 15; d++)
      await db.run("INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, 'USD', 2.5)", [
        `2026-10-${String(d).padStart(2, '0')}`,
      ]);
    backToTabs();
    await openMenu('Настройки');
    await tap('$ USD');
    backToTabs();
    // 🔒 and the fund row both show 300 ₾ — wait on the fund's progress text which is unique
    await screen.findByText(/150 из 1/);
    const t = texts();
    const i = t.lastIndexOf('👕 Одежда');
    expect(t.slice(i + 1, i + 3)).toEqual([
      '300 / 300 ₾ · 100%',
      'взнос в копилку · 150 из 1 500 ₾ · к 31 января 2027',
    ]);
  });

  test('past what is free, 🔒 set as an amount gives way without asking', async () => {
    await openApp(planned);
    // 2 700 over 4 months: 675 a month, 640 free — 35 from 🔒
    await fillFund('2700');
    await tap('Сохранить копилку');
    expect(await screen.findByText('Копилка «👕 Одежда» сохранена')).toBeTruthy();
    expect(await fund()).toMatchObject({ target_minor: 270000 });
    expect(await (await getDb()).get("SELECT locked_minor AS l FROM plan_months WHERE ym = '2026-10'")).toEqual({
      l: 26500,
    });
  });

  test('6.5.12 its card: «✓ Успеваете к …» — the contribution fits (of the free part and 🔒)', async () => {
    await openApp(planned);
    await fillFund('2700');
    await tap('Сохранить копилку');
    expect(await screen.findByText('✓ Успеваете к 31 января')).toBeTruthy();
    expect(screen.getByText(`Взнос 675${N}₾ в месяц влезает: свободно в плане 640${N}₾ + из 🔒 35${N}₾.`)).toBeTruthy();
    expect(screen.getByText(`В таком темпе 2 700${N}₾ будут к 31 января 2027.`)).toBeTruthy();
  });

  test('6.5.13 not making it: why, «Сдвинуть на …» and «Копить … к …» — saved at once, «Отменить» puts it back', async () => {
    await openApp(planned);
    // 4 000 over 4 months: 1 000 a month, 940 is left for it (640 free + 300 of 🔒)
    await fillFund('4000');
    await tap('Сохранить копилку');
    expect(await screen.findByText('⚠ Не успеваете к 31 января')).toBeTruthy();
    expect(
      screen.getByText(
        `Нужно 1 000${N}₾ в месяц, а копилке остаётся 940${N}₾: свободно в плане 640${N}₾ + из 🔒 300${N}₾ (сначала — копилки с датой раньше).`,
      ),
    ).toBeTruthy();
    expect(screen.getByText(`В таком темпе к 31 января будет ≈ 3 760${N}₾ из 4 000${N}₾.`)).toBeTruthy();
    await tap(`Копить 3 760${N}₾ к 31 января`);
    expect(await screen.findByText(`Копилка «👕 Одежда» — 3 760${N}₾`)).toBeTruthy();
    expect(await fund()).toMatchObject({ target_minor: 376000, due: '2027-01-31' });
    expect(await screen.findByText('✓ Успеваете к 31 января')).toBeTruthy();
    await tap('Отменить');
    expect(await screen.findByText('⚠ Не успеваете к 31 января')).toBeTruthy();
    expect(await fund()).toMatchObject({ target_minor: 400000 });
    await tap('Сдвинуть на 28 февраля 2027');
    expect(await screen.findByText('Копилка «👕 Одежда» — к 28 февраля 2027')).toBeTruthy();
    expect(await fund()).toMatchObject({ target_minor: 400000, due: '2027-02-28' });
    // the stats: «взнос 940 / 1 000 ₾ · ⚠ не успевает ›» before the move — now it makes it
    expect(await screen.findByText('✓ Успеваете к 28 февраля')).toBeTruthy();
  });

  test("6.5.14 the stats: a fund not making it — «взнос … / … · ⚠ не успевает ›», a tap — its category's page", async () => {
    await openApp(planned);
    await fillFund('4000');
    await tap('Сохранить копилку');
    await screen.findByText('⚠ Не успеваете к 31 января');
    backToTabs();
    await tap('Статистика');
    await screen.findByLabelText('Добавить в план');
    await screen.findByLabelText('Добавить в план');
    await tap(`взнос 940${N}₾ / 1 000${N}₾ · ⚠ не успевает ›`);
    expect(await screen.findByText('⚠ Не успеваете к 31 января')).toBeTruthy();
  });

  test('nothing free, 🔒 empty: 0 this month, the next ones more — nothing asked', async () => {
    await openApp(async () => {
      await planned();
      await (await getDb()).run("UPDATE plan_months SET locked_minor = 0, locked_pct = NULL WHERE ym = '2026-10'");
      const { id } = (await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Продукты'"))!;
      // the plan takes all of it: 2 400 − 2 160 + 400 of Одежда freed (it becomes the fund) — 640 more to Продукты
      await (
        await getDb()
      ).run("UPDATE plan_items SET limit_minor = limit_minor + 94000 WHERE ym = '2026-10' AND category_id = ?", [id]);
    });
    await fillFund('1200');
    await tap('Сохранить копилку');
    expect(await screen.findByText('Копилка «👕 Одежда» сохранена')).toBeTruthy();
    expect(
      await (
        await getDb()
      ).get(
        "SELECT p.limit_minor AS l, p.cap_minor AS c FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = '2026-10' AND c.name = 'Одежда'",
      ),
    ).toEqual({ l: 0, c: 0 });
  });

  test('its card: what it has, the contributions and the spending; turned off — asked, "Отменить" brings it back', async () => {
    await makeFund();
    await pressAction('👕 Одежда', 'План');
    expect(await screen.findByText(`из 1 500${N}₾`)).toBeTruthy();
    expect(screen.getByText('К 31 января 2027 · ещё 3 взноса')).toBeTruthy();
    expect(screen.getByText('Октябрь · ZARA')).toBeTruthy();
    expect(screen.getByText('Октябрь · взнос, идёт')).toBeTruthy();
    expect(screen.getByText('Октябрь · уже отложено')).toBeTruthy();
    await tap('Выключить копилку');
    expect(await screen.findByText('Выключить копилку «👕 Одежда»?')).toBeTruthy();
    expect(
      screen.getByText(
        `Накоплено 150${N}₾ — они уйдут в сбережения октября. Траты категории снова будут из бюджета месяца, взноса в плане больше не будет.`,
      ),
    ).toBeTruthy();
    await tap('Выключить');
    expect(await screen.findByText('Копилка «👕 Одежда» выключена')).toBeTruthy();
    expect(await fund()).toMatchObject({ closed_ym: '2026-10' });
    await tap('Отменить');
    expect(await screen.findByText('Копилка «👕 Одежда» снова в плане')).toBeTruthy();
    expect(await fund()).toMatchObject({ closed_ym: null });
  });

  test('the stats: a fund spent from — under its part of «Сбережения», not in "Потрачено"', async () => {
    await openApp(async () => {
      await planned();
      const db = await getDb();
      const { id } = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'"))!;
      await setFund('2026-10', id, { target_minor: 150000, currency: 'GEL', due: '2027-01-31', start_minor: 30000 });
      const repair = (await db.run("INSERT INTO categories (name, emoji) VALUES ('Ремонт', '🔧')")).lastInsertRowid;
      await setFund('2026-10', repair, { target_minor: 12000, currency: 'GEL', due: '2027-03-31', start_minor: 0 });
    });
    await tap('Статистика');
    // ZARA 450 ₾ is the fund's: not in the month's spending (2 010 ₾ without the fund)
    expect(await screen.findByText(`потрачено 450${N}₾ из копилки`)).toBeTruthy();
    // the donut's total
    expect(screen.getByText(/^1.560.₾$/)).toBeTruthy();
    // one row, in «Сбережения»: its contribution, and under it what was spent from it; no "Копилки" section
    expect(screen.getAllByText('👕 Одежда')).toHaveLength(1);
    expect(screen.queryByText('Копилки')).toBeNull();
    expect(screen.queryByText(/^в копилке/)).toBeNull();
    // a fund nothing was spent from: its contribution only
    expect(screen.getAllByText('🔧 Ремонт')).toHaveLength(1);
    expect(screen.getAllByText(/из копилки$/)).toHaveLength(1);
    // a tap on it: no buttons; its long press's «Операции» — its operations of the month
    await tap('👕 Одежда');
    expect(screen.queryByLabelText('Операции')).toBeNull();
    await pressAction('👕 Одежда', 'Операции');
    expect(await screen.findByText('Категория · 1')).toBeTruthy();
    expect(screen.getByText('ZARA')).toBeTruthy();
  });

  test("the stats: a long press on a fund — «Операции», «План» (its sheet), «Динамика», as a category's", async () => {
    await openApp(async () => {
      await planned();
      const db = await getDb();
      const { id } = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'"))!;
      await setFund('2026-10', id, { target_minor: 150000, currency: 'GEL', due: '2027-01-31', start_minor: 30000 });
    });
    await tap('Статистика');
    fireEvent(await screen.findByText('👕 Одежда'), 'longPress', { nativeEvent: { pageX: 200, pageY: 500 } });
    expect(await screen.findByLabelText('Операции')).toBeTruthy();
    expect(screen.getByLabelText('Динамика')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('План'));
    expect(
      await screen.findByText('Траты категории «👕 Одежда» берутся из копилки и не тратят бюджет месяца.'),
    ).toBeTruthy();
  });

  test('the stats without a budget (no «Сбережения»): a fund spent from — in "Копилки"', async () => {
    await openApp(async () => {
      await planned();
      const db = await getDb();
      const { id } = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'"))!;
      await setFund('2026-10', id, { target_minor: 150000, currency: 'GEL', due: '2027-01-31', start_minor: 30000 });
      await setPlanBudget('2026-10', null);
    });
    await tap('Статистика');
    expect(await screen.findByText('Копилки')).toBeTruthy();
    expect(screen.getByText(`450${N}₾ из копилки`)).toBeTruthy();
    // its long press: the same menu — «Операции» are its operations of the month
    fireEvent(screen.getByText('👕 Одежда'), 'longPress', { nativeEvent: { pageX: 200, pageY: 500 } });
    expect(await screen.findByLabelText('Динамика')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Операции'));
    expect(await screen.findByText('ZARA')).toBeTruthy();
  });
});
