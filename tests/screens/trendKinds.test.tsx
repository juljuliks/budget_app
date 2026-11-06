// 5.8.8: a category's «Динамика» by how often it is spent on — a rare one (rent) its payments, a fund its contributions
// and spending; a transfer one has none. Today: Thursday 15 October 2026 (setup.ts).
import { openApp, openSettings, screen, tap, texts } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { findCategoryByName } from '../../src/db/categories';
import { setFund } from '../../src/db/plans';

const id = async (name: string) => (await findCategoryByName(name, null))!.id;
const after = (label: string, n: number) => { const t = texts(); const i = t.lastIndexOf(label); return t.slice(i + 1, i + 1 + n); };

async function openTrendOf(name: string) {
  await openSettings('Категории');
  await tap(name);
  await tap('Динамика трат');
}

test('5.8.8 rare, the amount nearly the same: this month, «Подорожал», how many months, the day, each payment', async () => {
  await openApp(async () => {
    await planned();
    // RENT 800 on the 3rd this month and the last (planned), in August, and 700 in July
    const home = await id('Дом и коммуналка');
    await buy('RENT', 800, on(3, 10, 2), home, { kind: 'payment' });
    await buy('RENT', 700, on(3, 10, 3), home, { kind: 'payment' });
  });
  await openTrendOf('🏠 Дом и коммуналка');
  expect(await screen.findByText('Нажмите на месяц, чтобы увидеть сумму')).toBeTruthy();
  expect(screen.queryByText('Неделя')).toBeNull();
  expect(screen.queryByText(/По дням недели/)).toBeNull();
  expect(screen.getByText(/^последний платёж 3 окт · /)).toBeTruthy();
  expect(after('Подорожал', 1)).toEqual(['+100 ₾ с августа: было 700 ₾, стало 800 ₾']);
  expect(after('Платежей', 1)).toEqual(['4 из 12 месяцев']);
  expect(after('Обычно списывается', 1)).toEqual(['3 числа']);
  expect(after('Платежи', 2)).toEqual(['3 окт · RENT', '800 ₾']);
});

test('5.8.8 a fund: how much of its target by when, the pace, its card', async () => {
  await openApp(async () => {
    await planned();
    await setFund('2026-10', await id('Развлечения'), { target_minor: 60000, currency: 'GEL', due: '2027-01-31', start_minor: 30000 });
  });
  await openTrendOf('🎮 Развлечения');
  expect(await screen.findByText('Вверх — отложено, вниз — потрачено из копилки')).toBeTruthy();
  expect(screen.getByText(/из 600 ₾ · к январю 2027/)).toBeTruthy();
  expect(screen.getByText('Потрачено из копилки')).toBeTruthy();
  await tap('Копилка: взносы и траты ›');
  expect(await screen.findByText('Удалить копилку')).toBeTruthy();
});

test('5.8.8 a transfer category has no «Динамика трат»', async () => {
  await openApp(planned);
  await openSettings('Категории');
  await tap(/Между своими картами/);
  // its page loaded: a category with no transfer has the plaque by now (5.8.5)
  await screen.findByText(/^Системная категория: переводы/);
  expect(screen.queryByText('Динамика трат')).toBeNull();
});
