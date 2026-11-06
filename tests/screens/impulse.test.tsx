// 7.1.6 and 5.8.7: impulsive purchases in the month's report and in a category's «Динамика»; «Покупка: без ответа» in
// the operations. Today: Thursday 15 October 2026 (setup.ts).
import { waitFor } from '@testing-library/react-native';
import { openApp, openHistoryPage, openSettings, screen, tap, texts } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { findCategoryByName } from '../../src/db/categories';

const id = async (name: string) => (await findCategoryByName(name, null))!.id;
const answer = async (tx: number, impulse: boolean, mood: string | null = null) =>
  (await getDb()).run('UPDATE transactions SET impulse = ?, mood = ? WHERE id = ?', [impulse ? 1 : 0, mood, tx]);

/**
 * `planned` with «Импульсивные покупки» on in Кафе and Одежда. September: Кафе (planned 300) — WOLT 350 impulsive (😰),
 * LUCA 30 considered, BARI 20 not answered (400: 100 over); Одежда (not in September's plan) — ZARA 100 impulsive (🥱).
 */
async function impulsive() {
  await planned();
  const cafe = await id('Кафе и рестораны');
  const clothes = await id('Одежда');
  await (await getDb()).run('UPDATE categories SET impulse = 1 WHERE id IN (?, ?)', [cafe, clothes]);
  const wolt = (await (await getDb()).get<{ id: number }>("SELECT id FROM transactions WHERE raw_merchant = 'WOLT' AND amount_minor = 35000"))!.id;
  await answer(wolt, true, 'anxious');
  await answer(await buy('LUCA', 30, on(8, 13, 1), cafe), false);
  await buy('BARI', 20, on(9, 13, 1), cafe);
  await answer(await buy('ZARA', 100, on(10, 15, 1), clothes), true, 'bored');
}

const after = (label: string | RegExp, n: number) => {
  // the last: the report's sheet and the dynamics' page are over the stats, which has the same names
  const t = texts();
  let i = t.length - 1;
  while (i >= 0 && !(typeof label === 'string' ? t[i] === label : label.test(t[i]))) i--;
  return t.slice(i + 1, i + 1 + n);
};

describe('7.1.6 the report: «Импульсивные покупки»', () => {
  beforeEach(async () => {
    await openApp(impulsive);
    await tap('Статистика');
    await openHistoryPage();
    await tap('Отчёт за месяц ›');
    await screen.findByText('Отчёт · Сентябрь 2026');
  });

  test('how many of the answered, what pushed, each category against its plan («без плана» if not in it)', async () => {
    expect(await screen.findByText('Импульсивные покупки')).toBeTruthy();
    expect(screen.getByText('отмечено 3 из 4')).toBeTruthy();
    expect(screen.getByText(/Импульсивные · 2/)).toBeTruthy();
    expect(screen.getByText(/Обдуманные · 1/)).toBeTruthy();
    expect(screen.getByText('Что подталкивает')).toBeTruthy();
    expect(screen.getByText('Чаще всего — тревога: 1 из 2 импульсивных покупок с ответом.')).toBeTruthy();
    expect(after('☕️ Кафе и рестораны', 2)).toEqual(['1 из 2 импульсивные · перерасход 100 ₾, из них 100 ₾ — импульсивные', '350 ₾']);
    expect(after(/^👕 Одежда/, 2)).toEqual(['1 из 1 импульсивные', '100 ₾']);
    expect(texts()).toContain('👕 Одежда без плана ');
  });

  test('«Отметить ещё 1 покупку ›»: the month\'s purchases with no answer, «Покупка: без ответа»', async () => {
    await tap('Отметить ещё 1 покупку ›');
    expect(await screen.findByText('Покупка: без ответа')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('BARI')).toBeTruthy());
    expect(screen.queryByText('LUCA')).toBeNull();
    expect(screen.queryByText('WOLT')).toBeNull();
  });
});

describe('5.8.7 a category\'s «Динамика»: impulsive purchases of 3 months', () => {
  async function openCafeTrend() {
    await openSettings('Категории');
    await tap('☕️ Кафе и рестораны');
    await tap('Динамика трат');
    return screen.findByText('Импульсивные покупки · за 3 месяца');
  }

  test('under 10 answers: how many, «Отметить N покупок ›»', async () => {
    await openApp(impulsive);
    await openCafeTrend();
    // September's two answered; this month's WOLT 40 and 50 and September's BARI not
    expect(await screen.findByText('Для анализа нужно 10 ответов, сейчас 2')).toBeTruthy();
    expect(screen.getByText('Отметить 3 покупки ›')).toBeTruthy();
    expect(screen.queryByText('Где чаще импульсивно')).toBeNull();
  });

  test('10 answers: the share, by month, where, what pushed', async () => {
    await openApp(async () => {
      await impulsive();
      const cafe = await id('Кафе и рестораны');
      for (let day = 1; day <= 8; day++) await answer(await buy('LUCA', 10, on(day, 18), cafe), day % 2 === 0, day % 2 === 0 ? 'bored' : null);
    });
    await openCafeTrend();
    expect(await screen.findByText('отмечено 10 из 13')).toBeTruthy();
    expect(screen.getByText(/Импульсивные · 5/)).toBeTruthy();
    expect(screen.getByText('Доля импульсивных по месяцам')).toBeTruthy();
    expect(screen.getByText('Где чаще импульсивно')).toBeTruthy();
    expect(screen.getByText('LUCA ›')).toBeTruthy();
    expect(after('🥱 Скука', 1)).toEqual(['4 · 40 ₾']);
  });
});
