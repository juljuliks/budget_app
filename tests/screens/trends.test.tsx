// 5.8: «Динамика трат» — this week / month against the usual by the same days, a category's page, «+N% к обычному»
// under the month's rows. Today: Thursday 15 October 2026 (setup.ts).
import { within } from '@testing-library/react-native';
import { back, openApp, openSettings, rowOf, screen, tap } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { findCategoryByName } from '../../src/db/categories';

/** `planned`, and the 3 months before this one: Кафе 60 ₾ by the 15th of July and August (350 in September), Продукты 300 */
async function withHistory() {
  await planned();
  const id = async (name: string) => (await findCategoryByName(name, null))!.id;
  const cafe = await id('Кафе и рестораны');
  const food = await id('Продукты');
  await buy('WOLT', 60, on(6, 13, 2), cafe);
  await buy('WOLT', 60, on(6, 13, 3), cafe);
  await buy('SPAR', 300, on(5, 10, 3), food);
  // tracked since June
  await buy('SPAR', 10, on(20, 10, 4), food);
}

async function openTrends(seed = planned) {
  await openApp(seed);
  await tap('Статистика');
  await tap('Динамика трат');
  await screen.findByText('Больше обычного');
}

describe('5.8 Динамика трат', () => {
  test('5.8.1 the week: the categories off their usual by the same days, most first; none below it', async () => {
    await openTrends();
    expect(screen.getByText('Эта неделя по сегодня — к обычной неделе по те же дни (медиана 8 прошлых недель)')).toBeTruthy();
    // CINEMA 300 on Monday; Продукты 85 Monday to today; Кафе 50 on Tuesday; nothing usually on those days
    const rows = ['🎮 Развлечения', '🛒 Продукты', '☕️ Кафе и рестораны'].map((n) => screen.getByText(n));
    expect(within(rowOf('🎮 Развлечения')).getByText('+300 ₾')).toBeTruthy();
    expect(within(rowOf('🎮 Развлечения')).getByText('300 ₾ · обычно 0 ₾ · раньше не было')).toBeTruthy();
    expect(rows).toHaveLength(3);
    // a payment once a month and a limit "крупно, раз в месяц" are not compared by days
    expect(screen.queryByText('🏠 Дом и коммуналка')).toBeNull();
    expect(screen.queryByText('👕 Одежда')).toBeNull();
    expect(screen.getByText('Больших изменений нет')).toBeTruthy();
    expect(screen.getByText('обычно в этот день')).toBeTruthy();
  });

  test('5.8.2 the month: too little history — said', async () => {
    await openTrends();
    await tap('Месяц');
    expect(await screen.findByText('Обычный месяц появится, когда наберётся 3 месяца трат.')).toBeTruthy();
    expect(screen.queryByText('Больше обычного')).toBeNull();
  });

  test('5.8.3 the month with 3 months behind: Кафе +50%, why; a category\'s page with its chart, months, merchants', async () => {
    await openTrends(withHistory);
    await tap('Месяц');
    const cafe = await screen.findByText('90 ₾ · обычно 60 ₾ · +50% к обычному');
    expect(cafe).toBeTruthy();
    // 2 purchases of 45 ₾ against one of 60 ₾ usually
    expect(screen.getByText('Дешевле: средний чек 45 ₾ вместо 60 ₾, 2 покупки вместо 1')).toBeTruthy();

    await tap('☕️ Кафе и рестораны');
    expect(await screen.findByText('Нажмите на столбик — сумма месяца')).toBeTruthy();
    await tap('сентябрь 2026');
    expect(screen.getByText('сентябрь 2026: 350 ₾')).toBeTruthy();
    expect(screen.getByText('Мерчанты · этот месяц')).toBeTruthy();
    expect(screen.getByText('WOLT ›')).toBeTruthy();
    expect(screen.getByText('2 операции в этом месяце ›')).toBeTruthy();
    back();
    expect(await screen.findByText('Больше обычного')).toBeTruthy();
  });

  test('5.8.4 «Все категории ›»: the sheet picks any category, its page opens', async () => {
    await openTrends();
    await tap('Все категории ›');
    await tap('🚕 Такси');
    expect(await screen.findByText('Нажмите на день — сумма и сколько обычно')).toBeTruthy();
    expect(screen.getByText('0 ₾')).toBeTruthy();
  });

  test('5.8.5 a category\'s page has «Динамика трат»', async () => {
    await openApp(planned);
    await openSettings('Категории');
    await tap('☕️ Кафе и рестораны');
    await tap('Динамика трат');
    expect(await screen.findByText('Нажмите на день — сумма и сколько обычно')).toBeTruthy();
  });

  test('5.8.6 the month\'s stats: «+N% к обычному» under a category well off its usual', async () => {
    await openApp(withHistory);
    await tap('Статистика');
    await screen.findByText('☕️ Кафе и рестораны');
    expect(await within(rowOf('☕️ Кафе и рестораны')).findByText('+50% к обычному')).toBeTruthy();
    // −24%: not enough to say
    expect(within(rowOf('🛒 Продукты')).queryByText(/к обычному/)).toBeNull();
  });
});
