// 5.8.8: a category's «Динамика» by how often it is spent on — a rare one (rent) its payments, a fund its contributions
// and spending; a transfer one has none. Today: Thursday 15 October 2026 (setup.ts).
import { openApp, openSettings, screen, tap, texts } from './app';
import { buy, on, planned } from '../e2e/seeds';
import { findCategoryByName } from '../../src/db/categories';
import { setFund } from '../../src/db/plans';
import { savePayment } from '../../src/db/recurring';
import { getDb } from '../../src/db';

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

test('5.8.8 subscriptions: one in $ — its own amount, lari in brackets; a month of last year picked — with its year', async () => {
  await openApp(async () => {
    await planned();
    const subs = await id('Подписки');
    await buy('ICLOUD', 3, on(5, 12, 1), subs, { currency: 'USD' });
    await (await getDb()).run("INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES ('2026-09-05', 'USD', 2.5)");
    await buy('NETFLIX.COM', 30, on(3, 12, 10), subs);
    await savePayment({ merchant_key: 'ICLOUD', name: 'iCloud', amount_minor: 300, currency: 'USD', period: 1, due: '2026-11-05' });
  });
  await openTrendOf('📺 Подписки');
  expect(await screen.findByText('3 $ (7.50 ₾)')).toBeTruthy();
  await tap('сен');
  expect(await screen.findByText('Сентябрь: 7.50 ₾')).toBeTruthy();
  // December 2025: the 12 months go over the year's turn
  await tap('дек');
  expect(await screen.findByText('Декабрь 2025: 30 ₾')).toBeTruthy();
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
  expect(await screen.findByText('Выключить копилку')).toBeTruthy();
});

test('5.8.8 a transfer category has no «Динамика трат»', async () => {
  await openApp(planned);
  await openSettings('Категории');
  await tap(/Между своими картами/);
  // its page loaded: a category with no transfer has the plaque by now (5.8.5)
  await screen.findByText(/^Системная категория: переводы/);
  expect(screen.queryByText('Динамика трат')).toBeNull();
});
