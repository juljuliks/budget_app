// 7: the month's report and the history. Today: 15 October 2026; September planned, August not.
import { waitFor } from '@testing-library/react-native';
import { openApp, screen, tap, texts, openHistoryPage, toStory } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { getDb } from '../../src/db';

async function openHistory() {
  await openApp(planned);
  await tap('Статистика');
  await openHistoryPage();
  await screen.findByText('Сентябрь 2026');
}
// the last: the stats under the history page have the same month titles and sections
const after = (label: string, n: number) => { const t = texts(); const i = t.lastIndexOf(label); return t.slice(i + 1, i + 1 + n); };
/** the same in the report sheet, over the History (the month's line has "В сбережения" too) */
const inReport = (label: string, n: number) => { const t = texts(); const i = t.lastIndexOf(label); return t.slice(i + 1, i + 1 + n); };

describe('7.2 the history', () => {
  beforeEach(openHistory);

  test('every month from the first: plan (with the share outside it), spent, what\'s left or the overspend; with a budget, saved', async () => {
    // 2 160 ₾ planned + 300 ₾ for spending outside the plan
    expect(after('Октябрь 2026', 6)).toEqual(['План', '2 460 ₾', 'Потрачено', '2 010 ₾', 'Осталось', '450 ₾']);
    expect(after('Сентябрь 2026', 6)).toEqual(['План', '1 700 ₾', 'Потрачено', '1 850 ₾', 'Перерасход плана', '⚠ 150 ₾']);
    // its "Итоги" not done: "?" and the way to them
    expect(after('Перерасход плана', 7)).toEqual(['⚠ 150 ₾', 'Бюджет', '3 000 ₾', 'Свободно', '1 300 ₾', 'В сбережения', '1 150 ₾ ?']);
    expect(after('Итоги не подведены: удалось ли отложить, взносы в копилки', 1)).toEqual(['Подвести итоги ›']);
    expect(after('Август 2026', 4)).toEqual(['План', '—', 'Потрачено', '400 ₾']);
  });

  test('the savings: "В сбережения" in the month\'s line, opened — 🔒 and 🌊 against the plan; this month "пока"', async () => {
    // October is on: the obligatory payment not paid yet (a 30 ₾ subscription) isn't leftover
    expect(after('Октябрь 2026', 12).slice(-2)).toEqual(['В сбережения', 'пока 960 ₾']);
    await tap('Сентябрь 2026');
    await screen.findByText('Всего в сбережения');
    const sep = () => { const t = texts(); const i = t.lastIndexOf('Сбережения'); return t.slice(i, i + 10); };
    expect(sep()).toEqual(['Сбережения', 'План', 'Отложено', '💰 Сэкономлено', 'не потрачено к концу месяца', '1 300 ₾', '1 150 ₾', 'Всего в сбережения', '', '1 150 ₾']);
    await tap('Сентябрь 2026');
    await tap('Октябрь 2026');
    await screen.findByText('Пока в сбережения');
    const oct = texts().slice(texts().lastIndexOf('Сбережения'));
    expect(oct.slice(0, 8)).toEqual(['Сбережения', 'План', 'Сейчас', '🔒 Отложено сразу', 'в начале месяца', '300 ₾', '300 ₾', '💰 Сэкономлено']);
    expect(oct).toContain('Пока в сбережения');
    expect(oct.some((t) => /^Месяц идёт: из «Сэкономлено» вычтены платежи, которые ещё не оплачены \(30 ₾\)/.test(t))).toBe(true);
  });

  test('the report only for a month that is over and had a plan', async () => {
    // October not over; August without a plan
    expect(screen.getAllByText('Отчёт за месяц ›')).toHaveLength(1);
  });

  test('a month opened: grouped as the stats — the plan\'s by section, "Вне плана"; ⚠ on the overspent; a category opens its operations', async () => {
    await tap('Сентябрь 2026');
    expect(await screen.findByText('⚠ 350 ₾')).toBeTruthy();
    expect(screen.getByText('Вне плана')).toBeTruthy();
    await tap('⚠ 350 ₾');
    expect(await screen.findByText('Категория · 1')).toBeTruthy();
    expect(screen.getByText('WOLT')).toBeTruthy();
  });
});

describe('7.1 the report — stories', () => {
  beforeEach(async () => {
    await openHistory();
    await tap('Отчёт за месяц ›');
    await screen.findByText('Отчёт · Сентябрь 2026');
  });

  test('7.1.2 «Отложено»: what was put aside, a year of it, its share of the budget, the month in numbers, where it came from', async () => {
    expect(screen.getByText('1 из 4')).toBeTruthy();
    expect(inReport('В сбережения', 2)).toEqual(['1 150 ₾', '≈ 13 800 ₾ за год в таком темпе']);
    // September: 3 000 ₾ budget, no % of its own (an amount), the settings' 10%
    expect(screen.getByText('38% бюджета · цель 10%')).toBeTruthy();
    expect(texts()).toEqual(expect.arrayContaining(['План', 'Потрачено']));
    expect(after('💰 Сэкономлено', 2)).toEqual(['1 150 ₾', '—']);
    expect(after('Всего', 2)).toEqual(['1 150 ₾', '—']);
    expect(screen.getByText('Итоги не подведены: факт появится, когда ответите, что удалось отложить')).toBeTruthy();
  });

  test('7.1.3 paging: «Дальше ›» / «‹ Назад», the edges too; the screens without data left out; «Готово» on the last closes', async () => {
    // no «Импульсивные покупки» this month: 4 screens
    await tap('Дальше ›');
    expect(await screen.findByText('2 из 4')).toBeTruthy();
    expect(screen.getByText('Что можно улучшить')).toBeTruthy();
    await tap('‹ Назад');
    expect(await screen.findByText('1 из 4')).toBeTruthy();
    await tap('#story-next-edge');
    expect(await screen.findByText('2 из 4')).toBeTruthy();
    await tap('#story-back-edge');
    expect(await screen.findByText('1 из 4')).toBeTruthy();
    await toStory('Что уже хорошо');
    expect(screen.getByText('4 из 4')).toBeTruthy();
    expect(screen.queryByText('Импульсивные покупки')).toBeNull();
    await tap('Готово');
    await waitFor(() => expect(screen.queryByText('Отчёт · Сентябрь 2026')).toBeNull());
  });

  test('7.1.4 «Что можно улучшить»: the overspent limits, plan / past it; «Вне плана сверх доли»: the biggest categories to plan', async () => {
    await toStory('Что можно улучшить');
    expect(after('Что можно улучшить', 1)).toEqual(['≈ −3 000 ₾ в год']);
    expect(after('☕️ Кафе и рестораны', 2)).toEqual(['план 300 ₾, факт 350 ₾', '−50 ₾']);
    expect(screen.getByText('Синим — план, оранжевым — сверх плана.')).toBeTruthy();
    await tap('Дальше ›');
    expect(await screen.findByText('Потрачено 200 ₾, доли на это нет · 11% всех трат')).toBeTruthy();
    expect(after('🚕 Такси', 3)).toEqual(['без плана', '−200 ₾', '＋ В план']);
    expect(screen.getByText('Без перерасхода отложили бы 1 400 ₾')).toBeTruthy();
  });

  test('7.1.5 «Что уже хорошо»: saved in the plan', async () => {
    await toStory('Что уже хорошо');
    expect(after('Что уже хорошо', 1)).toEqual(['≈ +1 200 ₾ в год']);
    expect(after('🛒 Продукты', 2)).toEqual(['план 600 ₾, факт 500 ₾', '+100 ₾']);
  });

  test('"＋ В план" plans that category (in the month after)', async () => {
    await toStory('＋ В план');
    // the only "＋ В план" in the report: Такси's
    await tap('Добавить в план: Такси');
    await tap('Сохранить');
    await waitFor(async () => expect(await (await getDb()).get(
      "SELECT 1 AS y FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE c.name = 'Такси'")).toEqual({ y: 1 }));
  });

  test('"Как посчитано" under the year', async () => {
    await toStory('Что можно улучшить');
    await tap('≈ −3 000 ₾ в год');
    expect(await screen.findByText('Как посчитано')).toBeTruthy();
    expect(screen.getByText(/^Перерасход лимитов 50 ₾ \+ вне плана сверх доли 200 ₾ = 250 ₾ за месяц; × 12 = −3 000 ₾\./)).toBeTruthy();
  });

  test('«Подвести итоги ›» — the month\'s «Итоги»', async () => {
    await tap('Подвести итоги ›');
    expect(await screen.findByText(/^Итоги · Сентябрь 2026/)).toBeTruthy();
  });
});

test('7.1.4a «Без категории: N операций» — «Разметить»: the month\'s operations without a category', async () => {
  await openApp(async () => { await planned(); await buy('KIOSK', 15, on(10, 12, 1)); });
  await tap('Статистика');
  await openHistoryPage();
  await screen.findByText('Сентябрь 2026');
  await tap('Отчёт за месяц ›');
  await toStory('Разметить');
  expect(screen.getByText('Без категории: 1 операция')).toBeTruthy();
  await tap('Разметить');
  await waitFor(() => expect(screen.queryByText('Отчёт · Сентябрь 2026')).toBeNull());
  expect(await screen.findByText('KIOSK')).toBeTruthy();
  expect(screen.queryByText('SPAR')).toBeNull();
});
