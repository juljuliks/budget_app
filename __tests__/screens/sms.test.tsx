// 1.1, 1.6: bank SMS as the background task takes them in (ingestSms) — every kind in the list, the ones that aren't
// operations, the merchants' names; the category a new one gets. Today: 15 October 2026.
import { act, within } from '@testing-library/react-native';
import { openApp, rowOf, screen } from './app';
import { getDb } from '../../src/db';
import { ingestSms } from '../../src/ingest';
import { autoCategory } from '../../scripts/e2e/seeds';

const sms = (body: string, minutesAgo = 0) => act(async () => { await ingestSms({ sender: 'TBC', body, timestamp: Date.now() - minutesAgo * 60000 }); });
const row = (text: string) => within(rowOf(text));
const tx = async (merchant: string | null) => (await getDb()).get<{ kind: string; a: number; c: string; k: string | null; at: number }>(
  "SELECT kind, amount_minor AS a, currency AS c, merchant_key AS k, occurred_at AS at FROM transactions WHERE coalesce(raw_merchant, '') = ?", [merchant ?? '']);

test('1.1: every kind, its sign, its name in the list; the amounts\' formats; the merchants\' names', async () => {
  await openApp();
  await sms('44.00GEL\nVISA (*1234)\nSPAR TBILISI GE\n15/10/2026 11:00\nBalance: 283.14GEL');
  await sms('Payment\n25.69GEL\nTELMICO\nID:1951043\n15/10/2026');
  await sms('Money Transfer:\n1.00 GEL\nMC GOLD\n15/10/2026');
  await sms('Money Transfer:\n15.00 GEL\nMC GOLD\n15/10/2026\nNINO B');
  await sms('Deposit Money: 100.00 GEL\nMC GOLD\n15/10/2026\nDEMID RIABOV');
  await sms('A refund of 94.78 GEL has been initiated by TEMU.COM to your MC GOLD (*1834).');
  await sms('Cash withdrawal\n200.00GEL\nATM TBC VAKE\n(*1234)\n15/10/2026 10:50');
  await sms('1,234.56 GEL\n(*1234)\nIKEA\n15/10/2026 10:40');
  await sms('$9.99\n(*1234)\nNETFLIX.COM\n15/10/2026 10:30');
  await sms('€5\n(*1234)\nLIDL\n15/10/2026 10:20');
  await sms('12.00GEL\n(*1234)\nLTD KEEPZ.ME*YANDEX GO\n15/10/2026 10:10');
  await sms('19.90GEL\n(*1234)\nAMZN Mktp US*2K3AB\n15/10/2026 10:00');
  await sms('8.50GEL\n(*1234)\nSPAR 123\n15/10/2026 09:50');
  await sms('3.00GEL\n(*1234)\nTBILISI MALL\n15/10/2026 09:40');
  await sms('Deposit Money: 5.00 GEL\nMC GOLD\n12/10/2026\nANA K');

  expect(await screen.findByText('SPAR TBILISI GE')).toBeTruthy();
  expect(row('SPAR TBILISI GE').getByText('−44.00 ₾')).toBeTruthy();
  expect(row('Оплата · TELMICO').getByText('−25.69 ₾')).toBeTruthy();
  // the card ("MC GOLD") is no merchant
  expect(row('Перевод').getByText('−1.00 ₾')).toBeTruthy();
  expect(row('Перевод · NINO B').getByText('−15.00 ₾')).toBeTruthy();
  expect(row('Пополнение · DEMID RIABOV').getByText('+100.00 ₾')).toBeTruthy();
  expect(row('Возврат · TEMU.COM').getByText('+94.78 ₾')).toBeTruthy();
  expect(row('Снятие наличных · ATM TBC VAKE').getByText('−200.00 ₾')).toBeTruthy();
  expect(row('IKEA').getByText('−1 234.56 ₾')).toBeTruthy();
  expect(row('NETFLIX.COM').getByText('−9.99 $')).toBeTruthy();
  expect(row('LIDL').getByText('−5.00 €')).toBeTruthy();
  // a gateway before the merchant, an order id after it
  expect(row('YANDEX GO').getByText('−12.00 ₾')).toBeTruthy();
  expect(row('AMZN Mktp US').getByText('−19.90 ₾')).toBeTruthy();
  expect(screen.getByText('12 октября')).toBeTruthy();
  // all new and without a category
  expect(screen.getByText('15')).toBeTruthy();

  expect(await tx('SPAR TBILISI GE')).toMatchObject({ kind: 'purchase', a: 4400, c: 'GEL', k: 'SPAR' });
  expect(await tx('SPAR 123')).toMatchObject({ k: 'SPAR' });
  expect(await tx('TBILISI MALL')).toMatchObject({ k: 'TBILISI MALL' });
  expect(await tx('NETFLIX.COM')).toMatchObject({ a: 999, c: 'USD', k: 'NETFLIX COM' });
  expect(await tx('LIDL')).toMatchObject({ a: 500, c: 'EUR' });
  // the time: from the text; a date of today only: the SMS's; another day's: its midnight
  expect(new Date((await tx('SPAR TBILISI GE'))!.at * 1000)).toEqual(new Date(2026, 9, 15, 11, 0));
  expect(Math.abs(Date.now() / 1000 - (await tx('TELMICO'))!.at)).toBeLessThan(60);
  expect(new Date((await tx('ANA K'))!.at * 1000)).toEqual(new Date(2026, 9, 12));
});

test('1.1.8–1.1.9: not operations — declined, a conversion, a code, an ad, zero; a balance only sets the balance', async () => {
  await openApp();
  for (const body of [
    'Payment declined\n25.00GEL\nSPAR\n(*1234)\n15/10/2026 11:00',
    'Insufficient funds\n30.00GEL\n(*1234)\nSPAR',
    'Conversion: 14.02 USD / 36.40 GEL / Rate: 2.5963',
    'Code: 195448 27.00 GEL payment at WOLT',
    'Скидка 20% в SPAR до конца недели! 50.00 GEL',
    '0.00GEL\n(*1234)\nSPAR\n15/10/2026 11:00',
    'Balance: 281.00GEL\n15/10/2026 11:30',
  ]) await sms(body);
  expect(await screen.findByText('281.00 ₾')).toBeTruthy();
  expect(screen.getByText(/^Операций пока нет\./)).toBeTruthy();
  expect((await (await getDb()).get<{ n: number }>('SELECT count(*) AS n FROM transactions'))!.n).toBe(0);
});

test('1.6: the category a new one gets — its merchant\'s, by a prefix, a refund\'s purchase; none for a transfer or a merchant of different categories', async () => {
  await openApp(autoCategory);
  await sms('12.00GEL\n(*1234)\nSPAR\n15/10/2026 11:50');
  await sms('30.00GEL\n(*1234)\nWOLT MARKET\n15/10/2026 11:51');
  await sms('Money Transfer:\n15.00 GEL\nMC GOLD\n15/10/2026\nNINO B');
  await sms('18.00GEL\n(*1234)\nGLOVO\n15/10/2026 11:53');
  await sms('A refund of 20.00 GEL has been initiated by TEMU.COM to your MC GOLD (*1834).');
  await sms('A refund of 7.00 GEL has been initiated by OLDSHOP to your MC GOLD (*1834).');
  expect(await screen.findByText('WOLT MARKET')).toBeTruthy();
  expect(row('SPAR').getByText(/^🛒 Продукты · /)).toBeTruthy();
  expect(row('SPAR').getByText('🤖 авто')).toBeTruthy();
  expect(row('WOLT MARKET').getByText(/^☕️ Кафе и рестораны · /)).toBeTruthy();
  expect(row('Перевод · NINO B').getByText('⚪️ Без категории')).toBeTruthy();
  expect(row('GLOVO').getByText('⚪️ Без категории')).toBeTruthy();
  // its purchase 10 days before has a category; OLDSHOP's 100 days before is too long ago
  expect(row('Возврат · TEMU.COM').getByText(/^🛍️ Покупки · /)).toBeTruthy();
  expect(row('Возврат · OLDSHOP').getByText('⚪️ Без категории')).toBeTruthy();
  // unread: the ones without a category
  expect(screen.getByText('3')).toBeTruthy();
});
