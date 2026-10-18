// 9.12: "Банки" — whose SMS and pushes are read; several banks: the balances apart, the "Банк" filter, a label on rows.
import { act, fireEvent } from '@testing-library/react-native';
import { openApp, openSettings, screen, tap, texts, backToTabs } from './app';
import { ops } from '../e2e/seeds';
import { getDb } from '../../src/db';
import { navigationRef } from '../../src/shared/navigation/navigation';

/** the switch toggled, its saving done */
async function toggle(label: string, on: boolean) {
  fireEvent(screen.getByLabelText(label), 'valueChange', on);
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
}

test('9.12.1: TBC read, Bank of Georgia off; turned on — "Балансы карт", the "Банк" filter, its label on its rows', async () => {
  await openApp(async () => {
    await ops();
    const db = await getDb();
    await db.run("INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, occurred_at, raw_sms, sms_hash, seen_at) VALUES ('bog', 'purchase', 1250, 'GEL', 'CARREFOUR', strftime('%s','now') - 60, 'x', 'bog1', 1)");
  });
  expect(screen.queryByText('Банк')).toBeNull();
  await openSettings('Банки');
  expect(await screen.findByText('Bank of Georgia')).toBeTruthy();
  expect(texts()).toEqual(expect.arrayContaining(['Разбор', 'встроенный', 'шаблоны сообщений · 0', '«TBC SMS»', '«BOG»']));
  await toggle('Читать Bank of Georgia', true);
  expect(await (await getDb()).get("SELECT value FROM app_settings WHERE key = 'banks_enabled'")).toEqual({ value: '["tbc","bog"]' });
  // the last bank on stays on
  await toggle('Читать TBC', false);
  await toggle('Читать Bank of Georgia', false);
  expect(await screen.findByText('Хотя бы один банк должен читаться')).toBeTruthy();
  await toggle('Читать TBC', true);

  backToTabs();
  expect(await screen.findByText('Балансы карт')).toBeTruthy();
  expect(await screen.findByText('Банк')).toBeTruthy();
  expect(screen.getByLabelText('Банк: BoG')).toBeTruthy();
  await tap('Банк');
  await tap('Bank of Georgia');
  await tap('Готово');
  expect(await screen.findByText('CARREFOUR')).toBeTruthy();
  expect(screen.queryByText('SPAR')).toBeNull();
});

test('9.12.2: "Импорт SMS из телефона" says from which banks; the link opens "Банки"', async () => {
  await openApp(ops);
  await tap('Настройки');
  await tap('Импорт SMS из телефона');
  expect(await screen.findByText('Из банка: TBC')).toBeTruthy();
  await tap('Другие банки — в «Банках» ›');
  expect(await screen.findByText('Bank of Georgia')).toBeTruthy();
});
