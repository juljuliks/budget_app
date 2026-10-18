// 6.6 "Подписки": its section in the plan, the sheet of the month's subscriptions, a day set for a merchant of "Подписки",
// a subscription added step by step. Today: 15 October 2026; the seed `planned` (Подписки 30 ₾ by hand) and NETFLIX.COM
// charged 30 ₾ on the 10th in "Подписки".
import { fireEvent } from '@testing-library/react-native';
import { openApp, screen, tap } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { subscriptionsCategoryId } from '../../src/db/categories';
import { savePayment } from '../../src/db/recurring';
import { setPlanBudget } from '../../src/db/plans';

const N = ' ';
const subs = async () => (await getDb()).all<{ name: string; merchant_key: string | null; amount_minor: number; period_months: number; due: string | null }>(
  'SELECT name, merchant_key, amount_minor, period_months, due FROM recurring_payments WHERE deleted_at IS NULL ORDER BY id');

async function seed() {
  await planned();
  await buy('NETFLIX.COM', 30, on(10, 10), await subscriptionsCategoryId());
  await buy('SPOTIFY', 18.4, on(25, 10, 1));
  await buy('SPOTIFY', 18.4, on(25, 10, 2));
}

async function openSubscriptions() {
  await openApp(seed);
  await tap('Статистика');
  await tap('План');
  await tap('📺 Подписки');
}

describe('6.6 subscriptions', () => {
  test('a merchant of "Подписки" without a day: the day offered from its last charge, then the plan counts it', async () => {
    await openSubscriptions();
    // by hand until a subscription has a day
    expect(await screen.findByText(/Сумма введена вручную/)).toBeTruthy();
    expect(screen.getByText('Без даты списания')).toBeTruthy();
    await tap('Подписка: NETFLIX.COM');
    // its last charge on the 10th plus a month
    expect(await screen.findByText(/^10 ноября 2026/)).toBeTruthy();
    expect(screen.getByText(`В план октября +30${N}₾`)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Название'), 'Netflix');
    await tap('Сохранить');
    expect(await screen.findByText('Netflix — следующее списание 10 ноября')).toBeTruthy();
    expect(await subs()).toEqual([{ name: 'Netflix', merchant_key: 'NETFLIX.COM', amount_minor: 3000, period_months: 1, due: '2026-11-10' }]);
    // October's charge done, counted by the plan now
    expect(await screen.findByText('✓ списано 10 окт')).toBeTruthy();
    expect(screen.queryByText(/Сумма введена вручную/)).toBeNull();
    // the sections as the plan's: the sum and its share of the budget (3 000 ₾)
    expect(screen.getByText('Списания в октябре')).toBeTruthy();
    expect(screen.getAllByText(' · 1%').length).toBeGreaterThanOrEqual(1);
  });

  test('a year one: the day follows the period until picked by hand; this month\'s charge is the year\'s', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    await tap('Раз в год');
    expect(await screen.findByText(/^10 октября 2027/)).toBeTruthy();
    await tap('Сохранить');
    // October's charge (the 10th) is the year's: done
    expect(await screen.findByText('раз в год · ✓ списано 10 окт')).toBeTruthy();
    expect((await subs())[0]).toMatchObject({ period_months: 12, due: '2027-10-10' });
  });

  test('"＋ Добавить подписку": step 1 the merchant (charged the same in two months — "Похожи на подписку"), step 2 the subscription', async () => {
    await openSubscriptions();
    await tap('＋ Добавить подписку');
    expect(await screen.findByText('Шаг 1 из 2 · Мерчант')).toBeTruthy();
    expect(screen.getByText('Похожи на подписку')).toBeTruthy();
    await tap('Подписка: SPOTIFY');
    expect(await screen.findByText('Шаг 2 из 2 · Подписка')).toBeTruthy();
    // its last charge on 25 August plus months, not in the past: 25 October
    expect(screen.getByText(/^25 октября 2026/)).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('SPOTIFY — следующее списание 25 октября')).toBeTruthy();
    // in the sheet and in the plan's row (its only payment: how often and when)
    expect((await screen.findAllByText(/25 окт, через 10 дней/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('каждый месяц · 25 окт, через 10 дней').length).toBe(2);
  });

  test('deleted from its sheet, asked; "Отменить" in the toast brings it back', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    await tap('Сохранить');
    await screen.findByText('✓ списано 10 окт');
    await tap('Подписка: NETFLIX.COM');
    await tap('Удалить подписку');
    expect(await screen.findByText('Удалить подписку «NETFLIX.COM»?')).toBeTruthy();
    await tap('Удалить');
    expect(await screen.findByText('Подписка «NETFLIX.COM» удалена')).toBeTruthy();
    expect(await subs()).toEqual([]);
    await tap('Отменить');
    expect(await screen.findByText('Подписка «NETFLIX.COM» снова в плане')).toBeTruthy();
    expect(await subs()).toHaveLength(1);
  });
});

describe('6.7.9 "Повторяющийся платёж" from the plan', () => {
  test('a one-off one made a repeating payment: the day offered from the last operation, then it is counted', async () => {
    await openApp(seed);
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 🏠 Дом и коммуналка');
    expect(await screen.findByRole('radio', { name: /Разовый платёж/, checked: true })).toBeTruthy();
    await tap(screen.getByRole('radio', { name: /Повторяющийся платёж/ }));
    // RENT on the 3rd plus a month
    expect(await screen.findByText(/^3 ноября 2026/)).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('каждый месяц · ✓ оплачено 3 окт')).toBeTruthy();
    expect(await (await getDb()).get("SELECT merchant_key, amount_minor, period_months, due FROM recurring_payments WHERE name = 'Дом и коммуналка'"))
      .toEqual({ merchant_key: null, amount_minor: 80000, period_months: 1, due: '2026-11-03' });
    expect(await (await getDb()).get("SELECT recurring FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 1 });
    // its row opens the plan's sheet again, the payment in it; another kind turns the repeating payments off
    await tap('🏠 Дом и коммуналка');
    expect(await screen.findByRole('radio', { name: /Повторяющийся платёж/, checked: true })).toBeTruthy();
    expect(await screen.findByText(/^3 ноября 2026/)).toBeTruthy();
    await tap(screen.getByRole('radio', { name: /Разовый платёж/ }));
    await tap('Сохранить');
    expect(await screen.findByText('План «🏠 Дом и коммуналка» сохранён, повторяющиеся платежи выключены')).toBeTruthy();
    expect(await (await getDb()).get("SELECT recurring FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 0 });
  });

  test('"Подписки": "Выключить повторяющиеся платежи" in its sheet; "Отменить" turns them back on', async () => {
    await openSubscriptions();
    await tap('Выключить повторяющиеся платежи');
    expect(await screen.findByText('Повторяющиеся платежи выключены')).toBeTruthy();
    expect(await (await getDb()).get("SELECT recurring FROM categories WHERE name = 'Подписки'")).toEqual({ recurring: 0 });
    await tap('Отменить');
    expect(await screen.findByText('Повторяющиеся платежи снова включены')).toBeTruthy();
    expect(await (await getDb()).get("SELECT recurring FROM categories WHERE name = 'Подписки'")).toEqual({ recurring: 1 });
  });
});

describe('6.7.8 saving up for a subscription', () => {
  test('a year one: "Откладывать каждый месяц?" — "Да" by default; the plan has the contribution ("копим")', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    await tap('Раз в год');
    expect(await screen.findByText('Откладывать каждый месяц?')).toBeTruthy();
    expect(screen.getByText(/^Да, по 3/)).toBeTruthy();
    expect(screen.getByText(/^В план октября \+3/)).toBeTruthy();
    await tap('Сохранить');
    // October's charge was before the saving: the month's; the contribution on top
    expect(await screen.findByText(/^списания 30.*копим 3/)).toBeTruthy();
    expect((await (await getDb()).all('SELECT since_ym FROM payment_savings'))).toEqual([{ since_ym: '2026-10' }]);
  });

  test('turned off with something saved: asked first, what it had goes to the month\'s savings; "Отменить" puts it back', async () => {
    await openApp(async () => {
      await seed();
      await setPlanBudget('2026-09', 500000, 'GEL');
      const id = await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period_months: 12, due: '2027-10-10' });
      const db = await getDb();
      await db.run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-09', 0)", [id]);
      await db.run("INSERT INTO payment_contributions (saving_id, ym, minor) VALUES (5, '2026-09', 1000)");
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Подписки');
    await tap('Подписка: Netflix');
    expect(await screen.findByText(`Отложено 10${N}₾ из 30${N}₾.`)).toBeTruthy();
    await tap('Нет, весь платёж в октябре');
    await tap('Сохранить');
    expect(await screen.findByText('Не откладывать на Netflix?')).toBeTruthy();
    expect(screen.getByText(/^На «Netflix» уже отложено 10/)).toBeTruthy();
    await tap('Не откладывать');
    expect(await screen.findByText(`Netflix — без откладывания, 10${N}₾ в сбережениях октября`)).toBeTruthy();
    expect(await (await getDb()).get('SELECT closed_ym, released_minor FROM payment_savings')).toEqual({ closed_ym: '2026-10', released_minor: 1000 });
    await tap('Отменить');
    expect(await screen.findByText('Netflix — снова откладываем')).toBeTruthy();
  });

  test('the repeating payments turned off with something saved: asked first', async () => {
    await openApp(async () => {
      await seed();
      await setPlanBudget('2026-09', 500000, 'GEL');
      const id = await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period_months: 12, due: '2027-10-10' });
      const db = await getDb();
      await db.run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-09', 0)", [id]);
      await db.run("INSERT INTO payment_contributions (saving_id, ym, minor) VALUES (5, '2026-09', 1000)");
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Подписки');
    await tap('Выключить повторяющиеся платежи');
    expect(await screen.findByText('Выключить повторяющиеся платежи?')).toBeTruthy();
    expect(screen.getByText(/^На платежи уже отложено: Netflix — 10/)).toBeTruthy();
    await tap('Выключить');
    expect(await screen.findByText('Повторяющиеся платежи выключены')).toBeTruthy();
  });
});

describe('6.6 subscriptions on the operations', () => {
  async function seedOps() {
    await buy('NETFLIX.COM', 30, on(10, 10), await subscriptionsCategoryId());
    await buy('SPOTIFY', 18.4, on(12, 10));
  }

  test('"Подписки" set on an operation of a merchant with none: how often, the next charge — from it', async () => {
    await openApp(seedOps);
    await tap('SPOTIFY');
    expect(await screen.findByText('Выберите категорию')).toBeTruthy();
    await tap('📺 Подписки');
    expect(await screen.findByText('📺 Подписка «SPOTIFY»')).toBeTruthy();
    expect(screen.getByText(/^12 ноября 2026/)).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('SPOTIFY — следующее списание 12 ноября')).toBeTruthy();
    expect((await subs())[0]).toMatchObject({ merchant_key: 'SPOTIFY', amount_minor: 1840, due: '2026-11-12' });
    // the list: how often under its amount
    expect(await screen.findByText(' каждый месяц')).toBeTruthy();
  });

  test('"Пропустить": kept without a day, not asked again', async () => {
    await openApp(seedOps);
    await tap('SPOTIFY');
    await tap('📺 Подписки');
    await tap('Пропустить');
    expect(await screen.findByText('SPOTIFY — без даты списания')).toBeTruthy();
    expect((await subs())[0]).toMatchObject({ merchant_key: 'SPOTIFY', due: null });
  });

  test("the operation's card: the subscription without a day — \"Задать дату\"; then the next charge and this year's", async () => {
    await openApp(seedOps);
    await tap('NETFLIX.COM');
    await tap('Задать дату ›');
    expect(await screen.findByText(/^10 ноября 2026/)).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('Следующее списание')).toBeTruthy();
    expect(screen.getByText('10 ноября 2026')).toBeTruthy();
    expect(screen.getByText(`1 раз · 30${N}₾`)).toBeTruthy();
    expect(screen.getByText('Изменить подписку ›')).toBeTruthy();
  });

  test('charged another amount than the subscription\'s: "Обновить подписку?"', async () => {
    await openApp(async () => {
      await seedOps();
      await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 2700, currency: 'GEL', period_months: 1, due: '2026-11-10' });
    });
    await tap('NETFLIX.COM');
    expect(await screen.findByText(/^Сумма выросла: было 27/)).toBeTruthy();
    await tap(`Обновить подписку на 30${N}₾?`);
    expect(await screen.findByText(`Netflix — 30${N}₾`)).toBeTruthy();
    expect((await subs())[0].amount_minor).toBe(3000);
  });
});
