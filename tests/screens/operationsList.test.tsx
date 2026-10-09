// 2.1: the operations by day.
import { waitFor, within } from '@testing-library/react-native';
import { openApp, rowOf, screen, tap } from './app';
import { ops } from '../e2e/seeds';
import { getDb } from '../../src/db';

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
  expect(row('Перевод · Сбережения').getByText(/^🏦 Сбережения · /)).toBeTruthy();
  // in its own currency
  expect(row('NETFLIX.COM').getByText('−10.00 $')).toBeTruthy();
});

test('2.1.6: unread ones in the badge; opening one marks it read', async () => {
  await openApp(ops);
  // the transfer and GLOVO: new and without a category
  await waitFor(() => expect(screen.getByText('2')).toBeTruthy());
  await tap('GLOVO');
  expect(await screen.findByText('Заметка')).toBeTruthy();
  await waitFor(async () => {
    const r = await (await getDb()).get<{ seen: number }>("SELECT seen_at IS NOT NULL AS seen FROM transactions WHERE raw_merchant = 'GLOVO'");
    expect(r?.seen).toBe(1);
  });
  await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
});

test('2.1.4: the day\'s arrow opens its stats', async () => {
  await openApp(ops);
  await screen.findByText('Сегодня');
  await tap('Траты за день: Сегодня');
  expect(await screen.findByText('за день')).toBeTruthy();
});
