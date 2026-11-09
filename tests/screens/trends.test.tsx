// 5.8: «Динамика трат» — this month against the usual by the same days, a category's page, «+N% к обычному»
// under the month's rows. Today: Thursday 15 October 2026 (setup.ts).
import { within } from '@testing-library/react-native';
import { back, openApp, openSettings, rowOf, screen, tap, texts } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { findCategoryByName } from '../../src/db/categories';

/**
 * `planned`, and the 3 months before this one: Кафе 60 ₾ by the 15th of July and August (350 in September; after the
 * 15th two more each) — BARI 300 on the 1st of this month takes it past all of them; Продукты 300
 */
async function withHistory() {
  await planned();
  const id = async (name: string) => (await findCategoryByName(name, null))!.id;
  const cafe = await id('Кафе и рестораны');
  const food = await id('Продукты');
  await buy('WOLT', 60, on(6, 13, 2), cafe);
  await buy('WOLT', 60, on(6, 13, 3), cafe);
  // after the 15th (not in «по те же дни»): 3 a month — frequent spending, not rare (stats/trendKind.ts)
  for (const m of [2, 3]) for (const d of [20, 25]) await buy('LUCA', 5, on(d, 13, m), cafe);
  await buy('SPAR', 300, on(5, 10, 3), food);
  // last week's Thursday: not in this week's
  await buy('BARI', 300, on(1, 13), cafe);
  // tracked since June
  await buy('SPAR', 10, on(20, 10, 4), food);
}

async function openTrends(seed = planned) {
  await openApp(seed);
  await tap('Статистика');
  await tap('Динамика трат');
  await screen.findByText('Все категории ›');
}

describe('5.8 Динамика трат', () => {
  test('5.8.1 the month only: no «Неделя / Месяц», what is put against what', async () => {
    await openTrends(withHistory);
    expect(screen.getByText('Этот месяц по сегодня — к обычному по те же дни (медиана до 6 прошлых месяцев); показаны те, что вышли за привычный разброс')).toBeTruthy();
    expect(screen.queryByText('Неделя')).toBeNull();
    expect(screen.queryByText('Месяц')).toBeNull();
  });

  test('5.8.2 the month: too little history — said', async () => {
    await openTrends();
    expect(await screen.findByText('Обычный месяц появится, когда наберётся 3 месяца трат.')).toBeTruthy();
    expect(screen.queryByText('Больше обычного')).toBeNull();
  });

  test('5.8.3 the month with 3 months behind: Кафе +550% (past all of them), why; a category\'s page with its chart, months, merchants', async () => {
    await openTrends(withHistory);
    // 390 ₾: more than each tracked month by the 15th (60, 60, 350)
    const cafe = await screen.findByText('390 ₾ · обычно 60 ₾ · +550% к обычному');
    expect(cafe).toBeTruthy();
    // 3 purchases of 130 ₾ on average against one of 60 ₾ usually
    expect(screen.getByText('Дороже: средний чек 130 ₾ вместо 60 ₾, 3 покупки вместо 1')).toBeTruthy();

    await tap('☕️ Кафе и рестораны');
    expect(await screen.findByText('Нажмите на столбик — сумма месяца')).toBeTruthy();
    await tap('сентябрь 2026');
    expect(screen.getByText('сентябрь 2026: 350 ₾')).toBeTruthy();
    expect(screen.getByText('Мерчанты')).toBeTruthy();
    expect(screen.getByText('WOLT ›')).toBeTruthy();
    expect(screen.getByText('3 операции в этом месяце ›')).toBeTruthy();
    // its weekdays: this week (Кафе 50 ₾ on Tuesday) over the usual ones, the week so far against them; a tap — a day's
    expect(screen.getByText(/^Эта неделя: 50.₾ · обычно .+ к четвергу$/)).toBeTruthy();
    expect(screen.getByText('Цветом — эта неделя, серым — обычно в этот день. Нажмите на день — сумма')).toBeTruthy();
    await tap('вт');
    expect(await screen.findByText(/^вт: 50.₾ · обычно /)).toBeTruthy();
    await tap('пт');
    expect(await screen.findByText(/^пт: ещё впереди · обычно /)).toBeTruthy();
    back();
    expect(await screen.findByText('Больше обычного')).toBeTruthy();
  });

  test('5.8.4 «Все категории ›»: the sheet picks any category, its page opens', async () => {
    await openTrends();
    await tap('Все категории ›');
    await tap('🚕 Такси');
    expect(await screen.findByText('Нажмите на столбик — сумма месяца')).toBeTruthy();
  });

  test('5.8.9 a category\'s merchants: this month, this year, all the time', async () => {
    await openTrends(async () => {
      await withHistory();
      // August 2025: before this year
      await buy('GLOVO', 900, on(10, 13, 14), (await findCategoryByName('Кафе и рестораны', null))!.id);
    });
    await tap('Все категории ›');
    await tap('☕️ Кафе и рестораны');
    expect(await screen.findByText('Мерчанты')).toBeTruthy();
    const list = () => { const t = texts(); return t.slice(t.indexOf('Всё время') + 1, t.indexOf('Всё время') + 7); };
    // this month (BARI on the 1st, WOLT 40 + 50)
    expect(await screen.findByText('BARI ›')).toBeTruthy();
    expect(list().slice(0, 4)).toEqual(['BARI ›', '300 ₾', 'WOLT ›', '90 ₾']);
    await tap('Год');
    // + WOLT 350 in September, 60 in July and August; LUCA 4 × 5
    expect(await screen.findByText('560 ₾')).toBeTruthy();
    expect(list().slice(0, 6)).toEqual(['WOLT ›', '560 ₾', 'BARI ›', '300 ₾', 'LUCA ›', '20 ₾']);
    expect(screen.queryByText('GLOVO ›')).toBeNull();
    await tap('Всё время');
    expect(await screen.findByText('GLOVO ›')).toBeTruthy();
    expect(list().slice(0, 2)).toEqual(['GLOVO ›', '900 ₾']);
  });

  test('5.8.5 a category\'s page has «Динамика трат»', async () => {
    await openApp(planned);
    await openSettings('Категории');
    await tap('☕️ Кафе и рестораны');
    await tap('Динамика трат');
    expect(await screen.findByText('Нажмите на столбик — сумма месяца')).toBeTruthy();
    // no usual yet: the head is this month's spending all the same (WOLT 40 + 50), not 0 — and WOLT in «Мерчанты»
    expect(await screen.findByText('WOLT ›')).toBeTruthy();
    expect(screen.getAllByText('90 ₾')).toHaveLength(2);
    expect(screen.queryByText('0 ₾')).toBeNull();
    // `planned`: Кафе spent in one full month only — too few to tell frequent from rare (5.8.8)
    expect(screen.getByText(/^Мало данных: нужно 2 полных месяца с тратами/)).toBeTruthy();
  });

  test('5.8.6 the month\'s stats: «+N% к обычному» under a category well off its usual', async () => {
    await openApp(withHistory);
    await tap('Статистика');
    await screen.findByText('☕️ Кафе и рестораны');
    expect(await within(rowOf('☕️ Кафе и рестораны')).findByText('+550% к обычному')).toBeTruthy();
    // −24%: not enough to say
    expect(within(rowOf('🛒 Продукты')).queryByText(/к обычному/)).toBeNull();
  });
});
