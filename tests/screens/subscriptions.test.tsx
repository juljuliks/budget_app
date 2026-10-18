// 6.6 "Подписки": its section in the plan, the sheet of the month's subscriptions, a day set for a merchant of "Подписки",
// a subscription added step by step. Today: 15 October 2026; the seed `planned` (Подписки 30 ₾ by hand) and NETFLIX.COM
// charged 30 ₾ on the 10th in "Подписки".
import { fireEvent } from '@testing-library/react-native';
import { openApp, screen, tap } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { subscriptionsCategoryId } from '../../src/db/categories';

const N = ' ';
const subs = async () => (await getDb()).all<{ name: string; merchant_key: string | null; amount_minor: number; period_months: number; due: string | null }>(
  'SELECT name, merchant_key, amount_minor, period_months, due FROM subscriptions WHERE deleted_at IS NULL ORDER BY id');

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
    expect(await screen.findByText(/25 окт, через 10 дней/)).toBeTruthy();
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
