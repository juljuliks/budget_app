// 2.1: the operations by day.
import { waitFor, within } from '@testing-library/react-native';
import { backToTabs, openApp, rowOf, screen, tap } from './app';
import { buy, daysAgo, ops } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { splitTransaction } from '../../src/db/parts';

test('2.1.2–2.1.5: days, their spending, the rows of each kind', async () => {
  await openApp(ops);
  expect(await screen.findByText('Сегодня')).toBeTruthy();
  // SPAR 30 + the transfer 10 − the refund 5; the deposit and the money moved to savings aren't spending
  expect(await screen.findByText('−35 ₾')).toBeTruthy();
  expect(screen.getByText('Вчера')).toBeTruthy();
  expect(await screen.findByText('−65 ₾')).toBeTruthy();
  // each row: what it is, its category and time, the amount with its sign
  const row = (name: string) => within(rowOf(name));
  expect(row('SPAR').getByText(/^🛒 Продукты · \d\d:\d\d$/)).toBeTruthy();
  expect(row('SPAR').getByText('−30.00 ₾')).toBeTruthy();
  expect(row('Перевод · NINO B').getByText('⚪️ Без категории')).toBeTruthy();
  expect(row('Перевод · NINO B').getByText('−10.00 ₾')).toBeTruthy();
  expect(row('Возврат · ZARA').getByText(/^👕 Одежда · /)).toBeTruthy();
  expect(row('Возврат · ZARA').getByText('+5.00 ₾')).toBeTruthy();
  expect(row('Пополнение · SALARY').getByText('+100.00 ₾')).toBeTruthy();
  expect(row('Перевод · Накопительный').getByText(/^🔁 Переводы: Между своими картами · /)).toBeTruthy();
  // in its own currency
  expect(row('NETFLIX.COM').getByText('−10.00 $')).toBeTruthy();
});

test('2.1.3: more came back than was spent — "+" in the day\'s header; a deposit doesn\'t count', async () => {
  await openApp(async () => {
    await ops();
    // 20 days ago: the seed's purchases (18) and two refunds (120.43) — 102.43 more came back
    await buy('TEMU.COM', 94.78, daysAgo(20), null, { kind: 'refund' });
    await buy('TEMU.COM', 25.65, daysAgo(20) + 60, null, { kind: 'refund' });
    // 22 days ago: the seed's purchases (15) and a deposit — still −15
    await buy('P2P', 2752, daysAgo(22), null, { kind: 'deposit' });
  });
  expect(await screen.findByText('+102.43\u00a0₾')).toBeTruthy();
  expect(screen.getByText('+2\u00a0752.00\u00a0₾')).toBeTruthy();
  expect(screen.getAllByText('−15\u00a0₾').length).toBeGreaterThan(0);
  expect(screen.queryByText('+2\u00a0737\u00a0₾')).toBeNull();
});

test('2.1.6: unread ones in the badge; opening one marks it read', async () => {
  await openApp(ops);
  // the transfer and GLOVO: new and without a category
  await waitFor(() => expect(screen.getByText('2')).toBeTruthy());
  await tap('GLOVO');
  expect(await screen.findByText('Описание')).toBeTruthy();
  await waitFor(async () => {
    const r = await (await getDb()).get<{ seen: number }>("SELECT seen_at IS NOT NULL AS seen FROM transactions WHERE raw_merchant = 'GLOVO'");
    expect(r?.seen).toBe(1);
  });
  // back from its page to the list
  backToTabs();
  await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
});

test('2.1.4: the day\'s arrow opens its stats', async () => {
  await openApp(ops);
  await screen.findByText('Сегодня');
  await tap('Траты за день: Сегодня');
  expect(await screen.findByText('за день')).toBeTruthy();
});

test('2.1.10: a split operation — its categories in the row; from the stats\' category, only its part there', async () => {
  await openApp(async () => {
    await ops();
    const db = await getDb();
    const id = (await db.get<{ id: number }>("SELECT id FROM transactions WHERE raw_merchant = 'SPAR'"))!.id;
    const clothes = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'"))!.id;
    const food = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Продукты'"))!.id;
    await splitTransaction(id, food, [{ category_id: clothes, amount_minor: 1200 }]);
  });
  expect(await screen.findByText('🛒 Продукты + 👕 Одежда')).toBeTruthy();
  expect(within(rowOf('SPAR')).getByText('−30.00\u00a0₾')).toBeTruthy();
  await tap('Статистика');
  await tap('👕 Одежда');
  expect(await screen.findByText('Категория · 1')).toBeTruthy();
  expect(await screen.findByText('👕 Одежда + 🛒 Продукты')).toBeTruthy();
  expect(within(rowOf('SPAR')).getByText('−12.00\u00a0₾')).toBeTruthy();
  expect(within(rowOf('SPAR')).getByText('из 30.00\u00a0₾')).toBeTruthy();
});

test('2.1.10: grouped by category, a split operation is in each of its parts\' groups with that part', async () => {
  await openApp(async () => {
    await ops();
    const db = await getDb();
    const id = (await db.get<{ id: number }>("SELECT id FROM transactions WHERE raw_merchant = 'SPAR'"))!.id;
    const clothes = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Одежда'"))!.id;
    const food = (await db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Продукты'"))!.id;
    await splitTransaction(id, food, [{ category_id: clothes, amount_minor: 1200 }]);
    // the groups on one page
    await db.run("DELETE FROM transactions WHERE raw_merchant = 'MARKET'");
  });
  await tap('#filter-group');
  await tap('По категориям');
  await waitFor(() => expect(screen.getAllByText('SPAR')).toHaveLength(2));
  // the rows (a group's header may show the same sum)
  expect(screen.getAllByText('−12.00\u00a0₾').length).toBeGreaterThan(0);
  expect(screen.getAllByText('−18.00\u00a0₾').length).toBeGreaterThan(0);
  expect(screen.getAllByText('из 30.00\u00a0₾')).toHaveLength(2);
});
