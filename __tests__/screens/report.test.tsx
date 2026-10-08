// 7: the month's report and the history. Today: 15 October 2026; September planned, August not.
import { waitFor } from '@testing-library/react-native';
import { openApp, screen, tap, texts } from './app';
import { planned } from '../../scripts/e2e/seeds';
import { getDb } from '../../src/db';

async function openHistory() {
  await openApp(planned);
  await tap('Статистика');
  await tap('История');
  await screen.findByText('Сентябрь 2026');
}
const after = (label: string, n: number) => { const t = texts(); const i = t.indexOf(label); return t.slice(i + 1, i + 1 + n); };

describe('7.2 the history', () => {
  beforeEach(openHistory);

  test('every month from the first: plan, spent, what\'s left or the overspend; with a budget, saved', async () => {
    expect(after('Октябрь 2026', 7)).toEqual(['⌄', 'План', '2 160 ₾', 'Потрачено', '2 010 ₾', 'Осталось', '150 ₾']);
    expect(after('Сентябрь 2026', 7)).toEqual(['⌄', 'План', '1 700 ₾', 'Потрачено', '1 850 ₾', 'Перерасход', '⚠ 150 ₾']);
    expect(after('Перерасход', 7)).toEqual(['⚠ 150 ₾', 'Бюджет', '3 000 ₾', 'Не распределено', '1 300 ₾', 'Сэкономлено', '1 150 ₾']);
    expect(after('Август 2026', 5)).toEqual(['⌄', 'План', '—', 'Потрачено', '400 ₾']);
  });

  test('the report only for a month that is over and had a plan', async () => {
    // October not over; August without a plan
    expect(screen.getAllByText('Отчёт за месяц ›')).toHaveLength(1);
  });

  test('a month opened: its categories, ⚠ on the overspent; a category opens its operations', async () => {
    await tap('Сентябрь 2026');
    expect(await screen.findByText('⚠ 350 ₾')).toBeTruthy();
    await tap('⚠ 350 ₾');
    expect(await screen.findByText('Категория · 1')).toBeTruthy();
    expect(screen.getByText('WOLT')).toBeTruthy();
  });
});

describe('7.1 the report', () => {
  beforeEach(async () => {
    await openHistory();
    await tap('Отчёт за месяц ›');
    await screen.findByText('Отчёт · Сентябрь 2026');
  });

  test('what was put aside, a year of it, and where it came from (adding up to it)', async () => {
    expect(after('В сбережения', 2)).toEqual(['1 150 ₾', '≈ 13 800 ₾ за год в таком темпе']);
    expect(after('Не распределено в плане', 1)).toEqual(['+1 300 ₾']);
    expect(after('Категории плана потратили меньше', 1)).toEqual(['+50 ₾']);
    expect(after('Вне плана сверх доли', 1)).toEqual(['−200 ₾']);
  });

  test('what to improve: the overspent limits, outside the plan past its share, its biggest categories to plan', async () => {
    expect(after('Что можно улучшить', 1)).toEqual(['≈ −3 000 ₾ в год']);
    expect(after('☕️ Кафе и рестораны', 2)).toEqual(['план 300 ₾, факт 350 ₾', '−50 ₾']);
    expect(screen.getByText('Потрачено 200 ₾, доли на это нет · 11% всех трат')).toBeTruthy();
    expect(after('🚕 Такси', 3)).toEqual(['без плана', '−200 ₾', '＋ В план']);
    expect(screen.getByText('Без перерасхода отложили бы 1 400 ₾')).toBeTruthy();
  });

  test('what is good already: saved in the plan', async () => {
    expect(after('Что уже хорошо', 1)).toEqual(['≈ +1 200 ₾ в год']);
    expect(after('🛒 Продукты', 2)).toEqual(['план 600 ₾, факт 500 ₾', '+100 ₾']);
  });

  test('"＋ В план" plans that category (in the month after)', async () => {
    // the only "＋ В план" in the report: Такси's
    await tap('Добавить в план: Такси');
    await tap('Сохранить');
    await waitFor(async () => expect(await (await getDb()).get(
      "SELECT 1 AS y FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE c.name = 'Такси'")).toEqual({ y: 1 }));
  });

  test('"Как посчитано" under the year', async () => {
    await tap('≈ −3 000 ₾ в год');
    expect(await screen.findByText('Как посчитано')).toBeTruthy();
    expect(screen.getByText(/^Перерасход лимитов 50 ₾ \+ вне плана сверх доли 200 ₾ = 250 ₾ за месяц; × 12 = −3 000 ₾\./)).toBeTruthy();
  });
});
