// 6.6 "Подписки": its section in the plan, the sheet of the month's subscriptions, a day set for a merchant of "Подписки",
// a subscription added step by step. Today: 15 October 2026; the seed `planned` (Подписки 30 ₾ by hand) and NETFLIX.COM
// charged 30 ₾ on the 10th in "Подписки".
import { fireEvent, waitFor } from '@testing-library/react-native';
import { openApp, screen, tap } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { subscriptionsCategoryId } from '../../src/db/categories';
import { savePayment } from '../../src/db/recurring';
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

  test('every week: not a subscription\'s period (the plan\'s repeating payment has it)', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    expect(await screen.findByText('Раз в год')).toBeTruthy();
    expect(screen.queryByText('Каждую неделю')).toBeNull();
  });

  test('"Один раз": the charge it was made from; done — in its month only, nothing after', async () => {
    await openSubscriptions();
    await tap('Подписка: NETFLIX.COM');
    await tap('Один раз');
    expect(await screen.findByText('Дата списания')).toBeTruthy();
    expect(screen.getByText(/^10 октября 2026/)).toBeTruthy();
    expect(screen.getByText('Списание одно: после него в план больше не встанет.')).toBeTruthy();
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

  describe('nothing free in the plan (Одежда 640 ₾: 2 400 ₾ planned of 2 400)', () => {
    const openFull = async () => {
      await openApp(async () => {
        await seed();
        const clothes = await (await getDb()).get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'");
        await setPlanAmount('2026-10', clothes!.id, 64000, 'limit', 'GEL', 'month');
      });
      await tap('Статистика');
      await tap('План');
      await tap('📺 Подписки');
      await tap('＋ Добавить подписку');
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
      expect(await screen.findByText('Нет списаний в октябре')).toBeTruthy();
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
    expect(await screen.findByText('каждый месяц · следующее 3 ноя')).toBeTruthy();
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

  test('a coming month\'s plan says the day, not "через …" (counted from today, it read as the month after)', async () => {
    await openApp(seed);
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 🏠 Дом и коммуналка');
    await tap(await screen.findByRole('radio', { name: /Повторяющийся платёж/ }));
    expect(await screen.findByText(/^3 ноября 2026/)).toBeTruthy();
    await tap('Сохранить');
    expect(await screen.findByText('каждый месяц · следующее 3 ноя')).toBeTruthy();
    await tap('Следующий месяц');
    expect(await screen.findByText('Ноябрь 2026')).toBeTruthy();
    expect(await screen.findByText('каждый месяц · 3 ноя')).toBeTruthy();
    expect(screen.queryByText(/через/)).toBeNull();
  });

  test('not charged this month: 0 at the right, "30 ₾ в ноябре" under its name', async () => {
    await openApp(async () => {
      await seed();
      const { createCategory } = require('../../src/db/categories');
      const { turnRecurring } = require('../../src/db/recurring');
      const sport = await createCategory('Спорт', '🏋️');
      await savePayment({ category_id: sport, merchant_key: null, name: 'Спорт', amount_minor: 3000, currency: 'GEL', period: 1, due: '2026-11-20' });
      await turnRecurring(sport, true);
    });
    await tap('Статистика');
    await tap('План');
    expect(await screen.findByText(`30${N}₾ в ноябре`)).toBeTruthy();
    expect(await (await getDb()).get("SELECT limit_minor FROM plan_items WHERE ym = '2026-10' AND category_id = (SELECT id FROM categories WHERE name = 'Спорт')"))
      .toEqual({ limit_minor: 0 });
  });

  // the seed's budget: 2 400 ₾ to plan (3 000 less 10% outside and 🔒 300), 2 160 planned — 240 free
  test('this month\'s charge past what is free: "Вычесть из сбережений?", what is short taken from 🔒', async () => {
    await openApp(seed);
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 👕 Одежда');
    await tap(await screen.findByRole('radio', { name: /Повторяющийся платёж/ }));
    fireEvent.changeText(await screen.findByDisplayValue('400'), '700');
    await tap('Сохранить');
    // ZARA on the 10th: October's charge counted — 300 ₾ more, 60 ₾ short
    expect(await screen.findByText('Вычесть из сбережений?')).toBeTruthy();
    expect(screen.getByText(`Свободного не хватает 60${N}₾ — их можно взять из сбережений.`)).toBeTruthy();
    await tap('Вычесть и сохранить');
    expect(await screen.findByText(`План «👕 Одежда» сохранён, из 🔒 вычтено 60${N}₾`)).toBeTruthy();
    expect(await (await getDb()).get("SELECT locked_minor FROM plan_months WHERE ym = '2026-10'")).toEqual({ locked_minor: 24000 });
  });

  test('more than 🔒 has: asked too — all of it taken, the plan over its budget; "Отмена" — nothing saved', async () => {
    await openApp(seed);
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 👕 Одежда');
    await tap(await screen.findByRole('radio', { name: /Повторяющийся платёж/ }));
    fireEvent.changeText(await screen.findByDisplayValue('400'), '1000');
    await tap('Сохранить');
    expect(await screen.findByText(`Свободного не хватает 360${N}₾, в сбережениях — 300${N}₾. План будет больше бюджета на 60${N}₾.`)).toBeTruthy();
    await tap('Отмена');
    expect(await screen.findByDisplayValue('1000')).toBeTruthy();
    expect(await (await getDb()).get("SELECT count(*) AS n FROM recurring_payments WHERE name = 'Одежда'")).toEqual({ n: 0 });
    await tap('Сохранить');
    await tap('Вычесть и сохранить');
    expect(await screen.findByText(`План «👕 Одежда» сохранён, из 🔒 вычтено 300${N}₾`)).toBeTruthy();
    expect(await (await getDb()).get("SELECT locked_minor FROM plan_months WHERE ym = '2026-10'")).toEqual({ locked_minor: 0 });
  });

  test('every week from the plan: the day a week after the last spending, ± 3 days; each week\'s charge in the month', async () => {
    await openApp(seed);
    await tap('Статистика');
    await tap('План');
    await tap('Изменить: 🏠 Дом и коммуналка');
    await tap(await screen.findByRole('radio', { name: /Повторяющийся платёж/ }));
    await tap('Каждую неделю');
    // RENT on the 3rd: the 10th is past — the 17th
    expect(await screen.findByText(/^17 октября 2026/)).toBeTruthy();
    expect(screen.getByText('Списание засчитывается тратой категории за 3 дня до или после даты — дата сдвинется сама.')).toBeTruthy();
    await tap('Сохранить');
    // 3 200 ₾ past what is free: asked
    await tap('Вычесть и сохранить');
    await waitFor(async () => expect(await (await getDb()).get("SELECT period_months, period_unit, due FROM recurring_payments WHERE name = 'Дом и коммуналка'"))
      .toEqual({ period_months: 1, period_unit: 'week', due: '2026-10-17' }));
    // its row: the first charge not paid yet
    expect(await screen.findByText('каждую неделю · 17 окт, через 2 дня')).toBeTruthy();
    // October: the 3rd (paid), the 17th, 24th, 31st — 4 × 800 ₾
    expect(await (await getDb()).get("SELECT limit_minor FROM plan_items WHERE ym = '2026-10' AND category_id = (SELECT id FROM categories WHERE name = 'Дом и коммуналка')"))
      .toEqual({ limit_minor: 320000 });
  });

  test('"Подписки": no "Выключить повторяющиеся платежи" in its sheet — the plan turns them off, a subscription is deleted', async () => {
    await openSubscriptions();
    expect(await screen.findByText('＋ Добавить подписку')).toBeTruthy();
    expect(screen.queryByText('Выключить повторяющиеся платежи')).toBeNull();
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
      const id = await savePayment({ category_id: home, merchant_key: null, name: 'Страховка', amount_minor: 3000, currency: 'GEL', period: 12, due: '2027-10-10' });
      // "Уже отложено" 10 ₾ (its category's spending before — RENT — isn't paid from it)
      await db.run("INSERT INTO payment_savings (id, payment_id, since_ym, start_minor) VALUES (5, ?, '2026-10', 1000)", [id]);
    });
    await tap('Статистика');
    await tap('План');
    await tap('🏠 Дом и коммуналка');
    await tap(await screen.findByRole('radio', { name: /Разовый платёж/ }));
    await tap('Сохранить');
    expect(await screen.findByText('Выключить повторяющиеся платежи?')).toBeTruthy();
    expect(screen.getByText(/^На платежи уже отложено: Страховка — 10/)).toBeTruthy();
    await tap('Выключить');
    expect(await screen.findByText(/повторяющиеся платежи выключены$/)).toBeTruthy();
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
      await savePayment({ merchant_key: 'NETFLIX.COM', name: 'Netflix', amount_minor: 2700, currency: 'GEL', period: 1, due: '2026-11-10' });
    });
    await tap('NETFLIX.COM');
    expect(await screen.findByText(/^Сумма выросла: было 27/)).toBeTruthy();
    await tap(`Обновить подписку на 30${N}₾?`);
    expect(await screen.findByText(`Netflix — 30${N}₾`)).toBeTruthy();
    expect((await subs())[0].amount_minor).toBe(3000);
  });
});
