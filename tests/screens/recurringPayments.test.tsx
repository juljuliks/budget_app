// 6.6 "Подписки": its section in the plan, the sheet of the month's subscriptions, a day set for a merchant of "Подписки",
// a subscription made of an operation picked in the operations. Today: 15 October 2026; the seed `planned` (Подписки 30 ₾ by hand) and NETFLIX.COM
// charged 30 ₾ on the 10th in "Подписки".
import { fireEvent, waitFor } from '@testing-library/react-native';
import { back, backToTabs, openApp, openSettings, screen, tap, texts, toggleSwitch } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { subscriptionsCategoryId } from '../../src/db/categories';
import { savePayment, turnRecurring } from '../../src/db/recurring';
import { addManualTransaction } from '../../src/db/transactions';
import { setPlanAmount, setPlanBudget } from '../../src/db/plans';

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
    // no charges after it, if set
    expect(screen.getByText('Дата окончания (необязательно)')).toBeTruthy();
    await tap('Сохранить');
    // October's charge (the 10th) is the year's: done
    expect(await screen.findByText('раз в год · ✓ списано 10 окт')).toBeTruthy();
    expect((await subs())[0]).toMatchObject({ period_months: 12, due: '2027-10-10' });
  });

  test('a saved one: another period moves its next charge from the last one; back to its own — the day it had', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    await tap('Сохранить');
    await screen.findByText('✓ списано 10 окт');
    await tap('Подписка: NETFLIX.COM');
    expect(await screen.findByText(/^10 ноября 2026/)).toBeTruthy();
    await tap('Раз в год');
    expect(await screen.findByText(/^10 октября 2027/)).toBeTruthy();
    await tap('Раз в 3 месяца');
    expect(await screen.findByText(/^10 января 2027/)).toBeTruthy();
    await tap('Каждый месяц');
    expect(await screen.findByText(/^10 ноября 2026/)).toBeTruthy();
  });

  test('a saved one with its day long past: the next charge from its operations, another period from the one before it', async () => {
    await openApp(async () => {
      await seed();
      // set in July, charged since (the 10th of October): the day in the table stays July's
      await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period: 1, due: '2026-07-10' });
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Подписки');
    await tap('Подписка: Netflix');
    expect(await screen.findByText(/^10 ноября 2026/)).toBeTruthy();
    await tap('Раз в год');
    expect(await screen.findByText(/^10 октября 2027/)).toBeTruthy();
  });

  test('its operations: "N операций · сумма ›" (its merchant\'s), a tap — the operations searched by it, the sheets closed', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    expect(await screen.findByText(`1 операция · 30.00${N}₾ ›`)).toBeTruthy();
    await tap(`1 операция · 30.00${N}₾ ›`);
    expect(await screen.findByDisplayValue('NETFLIX.COM')).toBeTruthy();
    expect(screen.queryByText('Списания в октябре')).toBeNull();
  });

  test('every week: a subscription\'s period too (a weekly delivery)', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    expect(await screen.findByText('Раз в год')).toBeTruthy();
    expect(screen.getByText('Каждую неделю')).toBeTruthy();
  });

  test('"Один раз": the charge it was made from; done — in its month only, nothing after', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    await tap('Один раз');
    expect(await screen.findByText('Дата списания')).toBeTruthy();
    expect(screen.getByText(/^10 октября 2026/)).toBeTruthy();
    expect(screen.getByText('Списание одно: после него в план больше не встанет.')).toBeTruthy();
    expect(screen.queryByText('Дата окончания (необязательно)')).toBeNull();
    await tap('Сохранить');
    expect(await screen.findByText('NETFLIX.COM — списание 10 октября')).toBeTruthy();
    expect(await screen.findByText('один раз · ✓ списано 10 окт')).toBeTruthy();
    expect(screen.queryByText('Другие списания')).toBeNull();
    expect(await (await getDb()).get('SELECT period_unit, due FROM recurring_payments')).toEqual({ period_unit: 'once', due: '2026-10-10' });
  });

  test('"Предстоящие подписки": one not saved up for — "Без откладывания", a month of another year with the year', async () => {
    await openApp(async () => {
      await seed();
      await savePayment({ merchant_key: 'SPOTIFY', name: 'Spotify', amount_minor: 1840, currency: 'GEL', period: 12, due: '2027-08-25' });
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Подписки');
    // the month's sheet: this month's charges only, a line to the coming ones
    expect(await screen.findByText('Списания в октябре')).toBeTruthy();
    expect(screen.queryByText('Spotify')).toBeNull();
    await tap('Перейти: Предстоящие подписки ›');
    expect(await screen.findByText('Без откладывания')).toBeTruthy();
    expect(screen.getByText('в августе 2027')).toBeTruthy();
    // and back
    await tap('Перейти: Подписки октября ›');
    expect(await screen.findByText('Списания в октябре')).toBeTruthy();
  });

  test('"Предстоящие подписки": a year one charged this month, not saved up for — with its next charge, next year', async () => {
    await openApp(async () => {
      await seed();
      await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period: 12, due: '2026-10-10' });
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Подписки');
    expect(await screen.findByText('раз в год · ✓ списано 10 окт')).toBeTruthy();
    await tap('Перейти: Предстоящие подписки ›');
    expect(await screen.findByText('Без откладывания')).toBeTruthy();
    expect(screen.getByText('раз в год · 10 окт 2027')).toBeTruthy();
    expect(screen.getByText('в октябре 2027')).toBeTruthy();
  });

  test('no "＋ Добавить подписку": a subscription is made of a merchant of the category; one not a spending, one without a merchant — not listed', async () => {
    await openApp(async () => {
      await seed();
      const id = await subscriptionsCategoryId();
      await buy('APPLE', 5, on(12, 10), id, { kind: 'refund' });
      await addManualTransaction({ amount_minor: 1200, category_id: id, description: 'Кино дома', occurred_at: on(13, 10) });
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Подписки');
    expect(await screen.findByText('Без даты списания')).toBeTruthy();
    expect(screen.getByLabelText('Подписка: NETFLIX.COM')).toBeTruthy();
    expect(screen.queryByLabelText('Подписка: APPLE')).toBeNull();
    expect(screen.queryByText(/Кино дома/)).toBeNull();
    expect(screen.queryByText('＋ Добавить подписку')).toBeNull();
  });

  describe('nothing free in the plan (Одежда 640 ₾: 2 400 ₾ planned of 2 400)', () => {
    const openFull = async () => {
      await openApp(async () => {
        await seed();
        const clothes = await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'");
        await setPlanAmount('2026-10', clothes!.id, 64000, 'limit', 'GEL', 'month');
        // "Подписки" counted from its payments (Netflix's 30 ₾, as by hand), SPOTIFY charged there before
        await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period: 1, due: '2026-11-10' });
        await (await getDb()).run("UPDATE transactions SET category_id = ? WHERE merchant_key = 'SPOTIFY'", [await subscriptionsCategoryId()]);
      });
      await tap('Статистика');
      await tap('План');
      await tap('📺 Подписки');
      await tap('Подписка: SPOTIFY');
    };

    test('charged this month: "Вычесть из сбережений?" — "Вычесть и добавить" takes it from 🔒', async () => {
      await openFull();
      await tap('Сохранить');
      expect(await screen.findByText(`Свободного не хватает 18.40${N}₾ — их можно взять из сбережений.`)).toBeTruthy();
      await tap('Вычесть и добавить');
      expect(await screen.findByText('SPOTIFY — следующее списание 25 октября')).toBeTruthy();
      expect(await (await getDb()).get("SELECT locked_minor FROM plan_months WHERE ym = '2026-10'")).toEqual({ locked_minor: 28160 });
    });

    test('charged in a later month: its contribution asked; not saved up for (0 this month) — nothing asked', async () => {
      await openFull();
      await tap('Раз в год');
      expect(await screen.findByText(/^25 сентября 2027/)).toBeTruthy();
      await tap('Сохранить');
      // "Да, по 2 ₾ в месяц" by default: the contribution
      expect(await screen.findByText('Вычесть из сбережений?')).toBeTruthy();
      expect(screen.getByText(/^Свободного не хватает 2.*₾ — их можно взять из сбережений\.$/)).toBeTruthy();
      await tap('Отмена');
      await tap(await screen.findByText('Нет, весь платёж в сентябре 2027'));
      await tap('Сохранить');
      expect(await screen.findByText('SPOTIFY — следующее списание 25 сентября')).toBeTruthy();
      expect(await (await getDb()).get("SELECT locked_minor FROM plan_months WHERE ym = '2026-10'")).toEqual({ locked_minor: 30000 });
    });
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

describe('6.7.9 "Регулярный платёж" from the plan', () => {
  const home = "(SELECT id FROM categories WHERE name = 'Дом и коммуналка')";
  /** "Подписки" on for a category (as on its page) */
  const subscriptionsOn = async (name: string) => { await (await getDb()).run('UPDATE categories SET by_merchant = 1 WHERE name = ?', [name]); };
  const withSubscriptions = (name: string) => async () => { await seed(); await subscriptionsOn(name); };

  // the plan's sheet of "Дом и коммуналка" with "Подписки": "Регулярный платёж" — "Выбрать мерчанта": its page, RENT of
  // the 3rd made a subscription there
  async function pickRent() {
    await tap('Изменить: 🏠 Дом и коммуналка');
    await tap(await screen.findByRole('radio', { name: /Регулярный платёж/ }));
    await tap('Выбрать мерчанта');
    expect(await screen.findByText('Мерчанты без подписки')).toBeTruthy();
    await tap('Подписка: RENT');
    // RENT on the 3rd plus a month
    expect(await screen.findByText(/^3 ноября 2026/)).toBeTruthy();
  }
  /** the subscription saved on the category's page: back to the plan */
  async function saveBack() {
    await tap('Сохранить');
    expect(await screen.findByText(/— следующее списание/)).toBeTruthy();
    back();
  }

  test('a category with "Подписки": "Выбрать мерчанта" — its page; its merchant made a subscription, then it is counted', async () => {
    await openApp(withSubscriptions('Дом и коммуналка'));
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 🏠 Дом и коммуналка');
    expect(await screen.findByRole('radio', { name: /Разовый платёж/, checked: true })).toBeTruthy();
    await tap(screen.getByRole('radio', { name: /Регулярный платёж/ }));
    // no amount, no "Как часто": a subscription is made of a merchant on the category's page
    expect(await screen.findByText(/^Подписки делаются из мерчантов категории/)).toBeTruthy();
    expect(screen.queryByDisplayValue('800')).toBeNull();
    expect(screen.queryByText('Как часто')).toBeNull();
    await tap('Выбрать мерчанта');
    expect(await screen.findByText('Пока нет подписок: сделайте подпиской мерчанта ниже.')).toBeTruthy();
    await tap('Подписка: RENT');
    expect(await screen.findByText(/^3 ноября 2026/)).toBeTruthy();
    await saveBack();
    expect(await screen.findByText('каждый месяц · следующее 3 ноя')).toBeTruthy();
    expect(await (await getDb()).get("SELECT name, merchant_key, amount_minor, period_months, due FROM recurring_payments"))
      .toEqual({ name: 'RENT', merchant_key: 'RENT', amount_minor: 80000, period_months: 1, due: '2026-11-03' });
    expect(await (await getDb()).get("SELECT recurring FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 1 });
    // its row opens its subscriptions; "Изменить в плане" — the plan's sheet, no amount (counted); another kind — by hand
    await tap('🏠 Дом и коммуналка');
    expect(await screen.findByLabelText('Подписка: RENT')).toBeTruthy();
    await tap('Изменить в плане ›');
    expect(await screen.findByRole('radio', { name: /Регулярный платёж/, checked: true })).toBeTruthy();
    expect(screen.getByText('Сумма считается из списаний подписок категории. Другой вид — сумма вводится вручную, подписки останутся.')).toBeTruthy();
    await tap(screen.getByRole('radio', { name: /Разовый платёж/ }));
    await tap('Сохранить');
    expect(await screen.findByText('План «🏠 Дом и коммуналка» сохранён, регулярные платежи выключены')).toBeTruthy();
    expect(await (await getDb()).get("SELECT recurring, by_merchant FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 0, by_merchant: 1 });
  });

  test('without "Подписки", once a year: "Откладывать каждый месяц?" in the plan\'s sheet — "Да" saves up for it as a fund', async () => {
    await openApp(async () => {
      await seed();
      const id = (await (await getDb()).get<{ id: number }>(`SELECT id FROM categories WHERE name = 'Дом и коммуналка'`))!.id;
      await savePayment({ category_id: id, merchant_key: null, name: 'Дом и коммуналка', amount_minor: 120000, currency: 'GEL', period: 12, due: '2027-09-15' });
    });
    await tap('Статистика');
    await tap('План');
    await tap('🏠 Дом и коммуналка');
    expect(await screen.findByText('Откладывать каждый месяц?')).toBeTruthy();
    // saved before without it: "Нет" chosen
    expect(screen.getByRole('radio', { name: /^Нет, весь платёж в сентябре 2027/, checked: true })).toBeTruthy();
    await tap(screen.getByRole('radio', { name: /^Да, каждый месяц/ }));
    // chosen: the month's contribution in its title
    expect(await screen.findByRole('radio', { name: /^Да, по .* в месяц/, checked: true })).toBeTruthy();
    expect(screen.getByText('Уже отложено (необязательно)')).toBeTruthy();
    await tap('Сохранить');
    await waitFor(async () => expect(await (await getDb()).get('SELECT count(*) AS n FROM payment_savings WHERE closed_ym IS NULL')).toEqual({ n: 1 }));
    // monthly: no question
    await tap(await screen.findByText('🏠 Дом и коммуналка'));
    await tap('Каждый месяц');
    expect(screen.queryByText('Откладывать каждый месяц?')).toBeNull();
  });

  test('without "Подписки", once a year from a day past this month: only the plan — this month\'s charge in it, the next by the period; the operations aren\'t matched with it', async () => {
    await openApp(async () => {
      await seed();
      const id = (await (await getDb()).get<{ id: number }>(`SELECT id FROM categories WHERE name = 'Дом и коммуналка'`))!.id;
      await savePayment({ category_id: id, merchant_key: null, name: 'Дом и коммуналка', amount_minor: 80000, currency: 'GEL', period: 12, due: '2026-10-03' });
    });
    // RENT 800 ₾ of the 3rd: no card, nothing asked
    await tap('Оплата · RENT');
    expect(await screen.findByText('SMS')).toBeTruthy();
    expect(screen.queryByText(/раз в год/)).toBeNull();
    expect(screen.queryByText('Это оплата?')).toBeNull();
    await backToTabs();
    await tap('Статистика');
    expect(screen.queryByText(/Оплачено \d+ из/)).toBeNull();
    await tap('План');
    expect(await screen.findByText('раз в год · следующее 3 окт 2027')).toBeTruthy();
    expect(await (await getDb()).get(`SELECT kind, limit_minor FROM plan_items WHERE ym = '2026-10' AND category_id = ${home}`)).toEqual({ kind: 'subs', limit_minor: 80000 });
    // its row: the plan's sheet with it
    await tap('🏠 Дом и коммуналка');
    expect(await screen.findByRole('radio', { name: /Регулярный платёж/, checked: true })).toBeTruthy();
    expect(await screen.findByDisplayValue('800')).toBeTruthy();
    expect(screen.getByText('Сумма платежа')).toBeTruthy();
    // the day as it was put in, not the next one
    expect(await screen.findByText(/^3 октября 2026/)).toBeTruthy();
    expect(screen.getByText('Дата списания')).toBeTruthy();
    expect(screen.getByText('Следующие — раз в год от этой даты; списание встанет в план своего месяца.')).toBeTruthy();
    // every month: no day — the amount in each month's plan
    await tap('Каждый месяц');
    expect(await screen.findByText('Сумма стоит в плане каждый месяц.')).toBeTruthy();
    expect(screen.queryByText('Дата списания')).toBeNull();
    expect(screen.queryByText('Выбрать операцию')).toBeNull();
  });

  test('without "Подписки", every month without a day: the amount stands in each month\'s plan (as a one-off payment repeated each month was)', async () => {
    await openApp(seed);
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 🏠 Дом и коммуналка');
    await tap(await screen.findByRole('radio', { name: /Регулярный платёж/ }));
    expect(await screen.findByText('Сумма стоит в плане каждый месяц.')).toBeTruthy();
    expect(screen.queryByText(/^Дата списания/)).toBeNull();
    await tap('Сохранить');
    expect(await screen.findByText('План «🏠 Дом и коммуналка» сохранён')).toBeTruthy();
    const db = await getDb();
    expect(await db.get('SELECT merchant_key, amount_minor, due FROM recurring_payments')).toEqual({ merchant_key: null, amount_minor: 80000, due: null });
    expect(await db.get(`SELECT kind, limit_minor FROM plan_items WHERE ym = '2026-10' AND category_id = ${home}`)).toEqual({ kind: 'fixed', limit_minor: 80000 });
    // its row: how often only, no "без даты"
    expect(await screen.findByText('каждый месяц')).toBeTruthy();
    expect(screen.queryByText('каждый месяц · без даты')).toBeNull();
    // November: with the same amount
    await tap('Следующий месяц');
    expect(await screen.findByText('Ноябрь 2026')).toBeTruthy();
    await waitFor(async () => expect(await db.get(`SELECT limit_minor FROM plan_items WHERE ym = '2026-11' AND category_id = ${home}`)).toEqual({ limit_minor: 80000 }));
    // its sheet again: no day
    await tap('Предыдущий месяц');
    await tap(await screen.findByText('🏠 Дом и коммуналка'));
    expect(await screen.findByDisplayValue('800')).toBeTruthy();
    expect(await screen.findByText('Сумма стоит в плане каждый месяц.')).toBeTruthy();
  });

  test('a coming month\'s plan says the day, not "через …" (counted from today, it read as the month after)', async () => {
    await openApp(withSubscriptions('Дом и коммуналка'));
    await tap('Статистика');
    await tap('План');
    await pickRent();
    await saveBack();
    expect(await screen.findByText('каждый месяц · следующее 3 ноя')).toBeTruthy();
    await tap('Следующий месяц');
    expect(await screen.findByText('Ноябрь 2026')).toBeTruthy();
    expect(await screen.findByText('каждый месяц · 3 ноя')).toBeTruthy();
    // the subscription's sheet gone (it closes animated)
    await waitFor(() => expect(screen.queryByText(/через/)).toBeNull());
  });

  test('not charged this month: 0 at the right, "30 ₾ в ноябре" under its name', async () => {
    await openApp(async () => {
      await seed();
      const { createCategory } = require('../../src/db/categories');
      const sport = await createCategory('Спорт', '🏋️');
      await savePayment({ category_id: sport, merchant_key: 'FITPASS', name: 'Спорт', amount_minor: 3000, currency: 'GEL', period: 1, due: '2026-11-20' });
      await turnRecurring(sport, true);
    });
    await tap('Статистика');
    await tap('План');
    expect(await screen.findByText(`30${N}₾ в ноябре`)).toBeTruthy();
    expect(await (await getDb()).get("SELECT limit_minor FROM plan_items WHERE ym = '2026-10' AND category_id = (SELECT id FROM categories WHERE name = 'Спорт')"))
      .toEqual({ limit_minor: 0 });
  });

  test('"Удалить из плана": asked; gone from this month and the next ones, its payments off; "Отменить" — all back', async () => {
    await openApp(withSubscriptions('Дом и коммуналка'));
    await tap('Статистика');
    await tap('План');
    await pickRent();
    await saveBack();
    expect(await screen.findByText('каждый месяц · следующее 3 ноя')).toBeTruthy();
    // November's plan made: the subscription counted there too
    await tap('Следующий месяц');
    expect(await screen.findByText('каждый месяц · 3 ноя')).toBeTruthy();
    await tap('Предыдущий месяц');
    await tap(await screen.findByText('🏠 Дом и коммуналка'));
    await tap('Изменить в плане ›');
    await tap('Удалить из плана');
    expect(await screen.findByText('Убрать «🏠 Дом и коммуналка» из плана?')).toBeTruthy();
    expect(screen.getByText('У категории регулярные платежи — они выключатся, а категория пропадёт из плана с октября. Операции не изменятся.')).toBeTruthy();
    await tap('Убрать из плана');
    expect(await screen.findByText('«🏠 Дом и коммуналка» убрана из плана, регулярные платежи выключены')).toBeTruthy();
    const db = await getDb();
    const items = () => db.all(`SELECT ym FROM plan_items WHERE category_id = ${home} ORDER BY ym`);
    await waitFor(async () => expect(await items()).toEqual([{ ym: '2026-09' }]));
    expect(await db.get("SELECT recurring FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 0 });
    await tap('Отменить');
    expect(await screen.findByText('«🏠 Дом и коммуналка» снова в плане')).toBeTruthy();
    await waitFor(async () => expect(await items()).toEqual([{ ym: '2026-09' }, { ym: '2026-10' }, { ym: '2026-11' }]));
    expect(await db.get("SELECT recurring FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 1 });
  });

  // the seed's budget: 2 400 ₾ to plan (3 000 less 10% outside and 🔒 300), 2 160 planned — 240 free; Одежда 400 ₾ by hand
  async function pickZara(amount: string) {
    await tap('Изменить: 👕 Одежда');
    await tap(await screen.findByRole('radio', { name: /Регулярный платёж/ }));
    await tap('Выбрать мерчанта');
    await tap('Подписка: ZARA');
    expect(await screen.findByText('👕 Подписка «ZARA»')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Сумма'), amount);
    await tap('Сохранить');
  }

  test('this month\'s charge past what is free: "Вычесть из сбережений?" — the item by hand becomes the charge, what is short taken from 🔒', async () => {
    await openApp(withSubscriptions('Одежда'));
    await tap('Статистика');
    await tap('План');
    await pickZara('700');
    // ZARA on the 10th: October's charge counted instead of the 400 by hand — 300 ₾ more, 60 ₾ short
    expect(await screen.findByText('Вычесть из сбережений?')).toBeTruthy();
    expect(screen.getByText(`Свободного не хватает 60${N}₾ — их можно взять из сбережений.`)).toBeTruthy();
    await tap('Вычесть и добавить');
    expect(await screen.findByText('ZARA — следующее списание 10 ноября')).toBeTruthy();
    expect(await (await getDb()).get("SELECT locked_minor FROM plan_months WHERE ym = '2026-10'")).toEqual({ locked_minor: 24000 });
  });

  test('more than 🔒 has: asked too — all of it taken, the plan over its budget; "Отмена" — nothing saved', async () => {
    await openApp(withSubscriptions('Одежда'));
    await tap('Статистика');
    await tap('План');
    await pickZara('1000');
    expect(await screen.findByText(`Свободного не хватает 360${N}₾, в сбережениях — 300${N}₾. План будет больше бюджета на 60${N}₾.`)).toBeTruthy();
    await tap('Отмена');
    expect(await screen.findByDisplayValue('1000')).toBeTruthy();
    expect(await (await getDb()).get("SELECT count(*) AS n FROM recurring_payments")).toEqual({ n: 0 });
    await tap('Сохранить');
    await tap('Вычесть и добавить');
    expect(await screen.findByText('ZARA — следующее списание 10 ноября')).toBeTruthy();
    expect(await (await getDb()).get("SELECT locked_minor FROM plan_months WHERE ym = '2026-10'")).toEqual({ locked_minor: 0 });
  });

  test('turned off in the plan with its subscription left: "Регулярный платёж" again — it counts again, nothing to pick', async () => {
    await openApp(async () => {
      await seed();
      const id = (await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Дом и коммуналка'"))!.id;
      await savePayment({ category_id: id, merchant_key: 'RENT', name: 'Квартира', amount_minor: 80000, currency: 'GEL', period: 1, due: '2026-11-03' });
      await turnRecurring(id, false);
    });
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 🏠 Дом и коммуналка');
    await tap(await screen.findByRole('radio', { name: /Регулярный платёж/ }));
    expect(await screen.findByText('Сумма будет считаться из списаний подписок категории.')).toBeTruthy();
    expect(screen.queryByText('Выбрать мерчанта')).toBeNull();
    await tap('Сохранить');
    expect(await screen.findByText('План «🏠 Дом и коммуналка» сохранён')).toBeTruthy();
    expect(await screen.findByText('каждый месяц · следующее 3 ноя')).toBeTruthy();
    expect(await (await getDb()).get("SELECT recurring FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 1 });
    expect(await (await getDb()).get('SELECT count(*) AS n FROM recurring_payments')).toEqual({ n: 1 });
  });

  test('a category\'s last subscription deleted: "Подписки" stay on, "нет подписок"; "Отменить" — back', async () => {
    await openApp(async () => {
      await seed();
      const id = (await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Дом и коммуналка'"))!.id;
      await savePayment({ category_id: id, merchant_key: 'RENT', name: 'RENT', amount_minor: 80000, currency: 'GEL', period: 1, due: '2026-11-03' });
    });
    await tap('Статистика');
    await tap('План');
    await tap('🏠 Дом и коммуналка');
    await tap('Подписка: RENT');
    await tap('Удалить подписку');
    await tap('Удалить');
    expect(await screen.findByText('Подписка «RENT» удалена')).toBeTruthy();
    expect(await (await getDb()).get("SELECT recurring, by_merchant FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 1, by_merchant: 1 });
    await tap('Отменить');
    expect(await screen.findByText('Подписка «RENT» снова в плане')).toBeTruthy();
    expect(await (await getDb()).get('SELECT count(*) AS n FROM recurring_payments WHERE deleted_at IS NULL')).toEqual({ n: 1 });
  });

  test('"Подписки" without subscriptions: "нет подписок" in its row', async () => {
    await openApp(seed);
    await tap('Статистика');
    await tap('План');
    expect(await screen.findByText('нет подписок')).toBeTruthy();
  });

  test('every week: a subscription — the day a week after its operation; each week\'s charge in the month', async () => {
    await openApp(withSubscriptions('Дом и коммуналка'));
    await tap('Статистика');
    await tap('План');
    await pickRent();
    await tap('Каждую неделю');
    // RENT on the 3rd: the 10th is past — the 17th
    expect(await screen.findByText(/^17 октября 2026/)).toBeTruthy();
    await tap('Сохранить');
    // 3 200 ₾ instead of the 800 by hand: past what is free — asked
    await tap('Вычесть и добавить');
    await waitFor(async () => expect(await (await getDb()).get("SELECT period_months, period_unit, due FROM recurring_payments WHERE merchant_key = 'RENT'"))
      .toEqual({ period_months: 1, period_unit: 'week', due: '2026-10-17' }));
    back();
    // its row: the first charge not paid yet
    expect(await screen.findByText('каждую неделю · 17 окт, через 2 дня')).toBeTruthy();
    // October: the 3rd (paid), the 17th, 24th, 31st — 4 × 800 ₾
    expect(await (await getDb()).get(`SELECT limit_minor FROM plan_items WHERE ym = '2026-10' AND category_id = ${home}`))
      .toEqual({ limit_minor: 320000 });
  });

  test('"Подписки": no "Выключить регулярные платежи" in its sheet — the plan turns them off, a subscription is deleted', async () => {
    await openSubscriptions();
    expect(await screen.findByText('Без даты списания')).toBeTruthy();
    expect(screen.queryByText('Выключить регулярные платежи')).toBeNull();
  });
});

describe('6.7.13 "Подписки" on a category\'s page', () => {
  async function openHome(prepare: () => Promise<void>) {
    await openApp(prepare);
    await openSettings('Категории');
    await tap('🏠 Дом и коммуналка');
    expect(await screen.findByText('Подписки')).toBeTruthy();
  }

  test('on: its regular payment asked, gone — the amount stays in the plan; off: its subscriptions asked, gone', async () => {
    await openHome(async () => {
      await seed();
      const id = (await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Дом и коммуналка'"))!.id;
      await savePayment({ category_id: id, merchant_key: null, name: 'Дом и коммуналка', amount_minor: 80000, currency: 'GEL', period: 1, due: '2026-10-25' });
    });
    expect(screen.getByText('Следить за списаниями мерчантов, как у Netflix или страховки: подписка делается из мерчанта категории.')).toBeTruthy();
    toggleSwitch(true);
    expect(await screen.findByText('Включить подписки?')).toBeTruthy();
    expect(screen.getByText('Регулярный платёж «Дом и коммуналка» удалится; сумма в плане останется, пока у подписок нет даты.')).toBeTruthy();
    await tap('Включить');
    expect(await screen.findByText('Подписки включены')).toBeTruthy();
    const db = await getDb();
    expect(await db.get("SELECT recurring, by_merchant FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 0, by_merchant: 1 });
    expect(await db.get('SELECT count(*) AS n FROM recurring_payments WHERE deleted_at IS NULL')).toEqual({ n: 0 });
    expect(await db.get(`SELECT kind, limit_minor FROM plan_items WHERE ym = '2026-10' AND category_id = (SELECT id FROM categories WHERE name = 'Дом и коммуналка')`))
      .toEqual({ kind: 'fixed', limit_minor: 80000 });
    expect(await screen.findByText('Каждый мерчант категории — отдельная подписка: сумма, как часто, следующее списание. План категории считается из них.')).toBeTruthy();
    // a subscription made, then off: asked
    await savePayment({ category_id: (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Дом и коммуналка'"))!.id, merchant_key: 'RENT', name: 'RENT', amount_minor: 80000, currency: 'GEL', period: 1, due: '2026-11-03' });
    toggleSwitch(false);
    expect(await screen.findByText('Выключить подписки?')).toBeTruthy();
    expect(screen.getByText('1 подписка удалится; сумма в плане останется, операции — тоже.')).toBeTruthy();
    await tap('Выключить');
    expect(await screen.findByText('Подписки выключены')).toBeTruthy();
    expect(await db.get("SELECT recurring, by_merchant FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 0, by_merchant: 0 });
    expect(await db.get('SELECT count(*) AS n FROM recurring_payments WHERE deleted_at IS NULL')).toEqual({ n: 0 });
  });

  test('on: its subscriptions and its merchants without one under it — "Сделать подпиской" makes one in a tap', async () => {
    await openApp(seed);
    await openSettings('Категории');
    await tap('📺 Подписки');
    expect(await screen.findByText('Пока нет подписок: сделайте подпиской мерчанта ниже.')).toBeTruthy();
    expect(screen.getByText('Мерчанты без подписки')).toBeTruthy();
    expect(screen.getByText('последняя 10 окт · Сделать подпиской')).toBeTruthy();
    await tap('Подписка: NETFLIX.COM');
    // the day offered from its last charge
    expect(await screen.findByText(/^10 ноября 2026/)).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('каждый месяц · следующее 10 ноя')).toBeTruthy();
    expect(screen.queryByText('Мерчанты без подписки')).toBeNull();
    expect(screen.queryByText('＋ Добавить подписку')).toBeNull();
  });

  test('a category without merchants\' charges: no switch', async () => {
    await openApp(async () => { await seed(); await require('../../src/db/categories').createCategory('Психолог', '🧠'); });
    await openSettings('Категории');
    await tap('🧠 Психолог');
    expect(await screen.findByDisplayValue('Психолог')).toBeTruthy();
    expect(screen.queryByLabelText('Подписки')).toBeNull();
  });

  test('nothing to delete: at once', async () => {
    await openHome(seed);
    toggleSwitch(true);
    expect(await screen.findByText('Подписки включены')).toBeTruthy();
    expect(await (await getDb()).get("SELECT by_merchant FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ by_merchant: 1 });
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
    // the month's sheet: its charges (October's was before the saving — the month's); the contribution — in the coming ones
    expect(await screen.findByText(/^копим 3.* в месяц$/)).toBeTruthy();
    await tap('Перейти: Предстоящие подписки ›');
    expect(await screen.findByText('Копим')).toBeTruthy();
    expect(screen.getByText(/^Копим в октябре/)).toBeTruthy();
    expect(screen.getByLabelText('Подписка: NETFLIX.COM')).toBeTruthy();
    expect((await (await getDb()).all('SELECT since_ym FROM payment_savings'))).toEqual([{ since_ym: '2026-10' }]);
    // in the plan the contribution is in "Сбережения" (like a fund's), not under "Подписки"
    expect(screen.getByLabelText('📺 Предстоящие подписки')).toBeTruthy();
    expect(screen.queryByText(/^копим 3/)).toBeNull();
  });

  test('all its payments in dollars: "(12 $)" before the month\'s charges in the plan, "(1 $)" before the contribution', async () => {
    await openApp(async () => {
      await seed();
      const db = await getDb();
      for (let d = 1; d <= 15; d++) await db.run("INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, 'USD', 2.5)", [`2026-10-${String(d).padStart(2, '0')}`]);
      await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 1200, currency: 'USD', period: 1, due: '2026-10-10' });
      const id = await savePayment({ merchant_key: 'SPOTIFY', name: 'Spotify', amount_minor: 1200, currency: 'USD', period: 12, due: '2027-10-25' });
      await db.run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-10', 0)", [id]);
    });
    await tap('Статистика');
    await tap('План');
    expect(await screen.findByText('(12 $)')).toBeTruthy();
    expect(screen.getByText('(1 $)')).toBeTruthy();
  });

  test('"Предстоящие подписки" in the plan\'s "Сбережения" opens the coming ones; "Подписки" in its section — the month\'s', async () => {
    await openApp(async () => {
      await seed();
      const id = await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period: 12, due: '2027-10-10' });
      await (await getDb()).run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-10', 1000)", [id]);
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Предстоящие подписки');
    expect(await screen.findByText(/^Копим в октябре/)).toBeTruthy();
    expect(screen.getByText(/из 30/)).toBeTruthy();
    expect(screen.queryByText('Списания в октябре')).toBeNull();
  });

  test('"Предстоящие подписки": one paid this month from what was saved — the charge it saves for now (next year)', async () => {
    await openApp(async () => {
      await seed();
      // a year one charged on the 10th (NETFLIX.COM in the seed), saved up for since September
      const id = await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period: 12, due: '2026-10-10' });
      await (await getDb()).run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-09', 1000)", [id]);
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Предстоящие подписки');
    expect(await screen.findByText(/^раз в год · 10 окт 2027/)).toBeTruthy();
  });

  test('turned off with something saved: asked first, what it had goes to the month\'s savings; "Отменить" puts it back', async () => {
    await openApp(async () => {
      await seed();
      await setPlanBudget('2026-09', 500000, 'GEL');
      const id = await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 3000, currency: 'GEL', period: 12, due: '2027-10-10' });
      const db = await getDb();
      await db.run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-09', 0)", [id]);
      await db.run("INSERT INTO payment_contributions (saving_id, ym, minor) VALUES (5, '2026-09', 1000)");
    });
    await tap('Статистика');
    await tap('План');
    await tap('📺 Подписки');
    await tap('Подписка: Netflix');
    expect(await screen.findByText(`Отложено 10${N}₾ из 30${N}₾.`)).toBeTruthy();
    await tap('Нет, весь платёж в октябре 2027');
    await tap('Сохранить');
    expect(await screen.findByText('Не откладывать на Netflix?')).toBeTruthy();
    expect(screen.getByText(/^На «Netflix» уже отложено 10/)).toBeTruthy();
    await tap('Не откладывать');
    expect(await screen.findByText(`Netflix — без откладывания, 10${N}₾ в сбережениях октября`)).toBeTruthy();
    expect(await (await getDb()).get('SELECT closed_ym, released_minor FROM payment_savings')).toEqual({ closed_ym: '2026-10', released_minor: 1000 });
    await tap('Отменить');
    expect(await screen.findByText('Netflix — снова откладываем')).toBeTruthy();
  });

  test('the repeating payments turned off in the plan with something saved: asked first', async () => {
    await openApp(async () => {
      await seed();
      const db = await getDb();
      const home = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Дом и коммуналка'"))!.id;
      await db.run('UPDATE categories SET recurring = 1 WHERE id = ?', [home]);
      const id = await savePayment({ category_id: home, merchant_key: 'INSURER', name: 'Страховка', amount_minor: 3000, currency: 'GEL', period: 12, due: '2027-10-10' });
      // "Уже отложено" 10 ₾
      await db.run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-10', 1000)", [id]);
    });
    await tap('Статистика');
    await tap('План');
    await tap('🏠 Дом и коммуналка');
    await tap('Изменить в плане ›');
    await tap(await screen.findByRole('radio', { name: /Разовый платёж/ }));
    await tap('Сохранить');
    expect(await screen.findByText('Выключить регулярные платежи?')).toBeTruthy();
    expect(screen.getByText(/^На платежи уже отложено: Страховка — 10/)).toBeTruthy();
    await tap('Выключить');
    expect(await screen.findByText(/регулярные платежи выключены$/)).toBeTruthy();
    expect(await (await getDb()).get("SELECT recurring FROM categories WHERE name = 'Дом и коммуналка'")).toEqual({ recurring: 0 });
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
    await tap('Сменить');
    await tap('📺 Подписки');
    expect(await screen.findByText('📺 Подписка «SPOTIFY»')).toBeTruthy();
    expect(screen.getByText(/^12 ноября 2026/)).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('SPOTIFY — следующее списание 12 ноября')).toBeTruthy();
    expect((await subs())[0]).toMatchObject({ merchant_key: 'SPOTIFY', amount_minor: 1840, due: '2026-11-12' });
    // the operation stays: its subscription, not the list behind it
    expect(await screen.findByText('SPOTIFY · каждый месяц')).toBeTruthy();
    expect(screen.getByText('Удалить операцию')).toBeTruthy();
    back();
    expect(await screen.findByText(' каждый месяц')).toBeTruthy();
  });

  test('"Пропустить": kept without a day, not asked again', async () => {
    await openApp(seedOps);
    await tap('SPOTIFY');
    await tap('Сменить');
    await tap('📺 Подписки');
    await tap('Пропустить');
    expect(await screen.findByText('SPOTIFY — без даты списания')).toBeTruthy();
    expect(screen.getByText('Подписка без даты списания')).toBeTruthy();
    expect(screen.getByText('Задать дату ›')).toBeTruthy();
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
      await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 2700, currency: 'GEL', period: 1, due: '2026-11-10' });
    });
    await tap('NETFLIX.COM');
    expect(await screen.findByText(/^Сумма выросла: было 27/)).toBeTruthy();
    await tap(`Обновить подписку на 30${N}₾?`);
    expect(await screen.findByText(`Netflix — 30${N}₾`)).toBeTruthy();
    expect((await subs())[0].amount_minor).toBe(3000);
  });
});
