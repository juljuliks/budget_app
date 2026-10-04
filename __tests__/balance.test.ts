import { ingestSms } from '../src/ingest';
import { cardBalance } from '../src/db/balance';
import { parseTbcBalance } from '../src/parsers/tbc';
import { addManualTransaction } from '../src/db/transactions';
import { freshDb } from './helpers';

const sms = (body: string, at: string) =>
  ingestSms({ sender: 'TBC SMS', body, timestamp: new Date(at).getTime() });

// the real sequence: a purchase with the balance, a P2P deposit without one, a purchase with the new balance
const SPAR = '17.69GEL\n(*1834)\nSPAR\nBalance: 91.14GEL\n\n03/10/26 15:19';
const DEPOSIT = 'Deposit Money: 280.00 GEL\nMC GOLD\n03/10/2026';
const BAR = '88.00GEL\n(*1834)\nPATARA BARI\nBalance: 283.14GEL\n\n03/10/26 17:19';

beforeEach(() => freshDb());

test('parseTbcBalance: purchases and balance-only SMS have it, deposits don\'t', () => {
  expect(parseTbcBalance(SPAR)).toMatchObject({ minor: 9114, currency: 'GEL', occurred_at: '2026-10-03T15:19:00' });
  expect(parseTbcBalance('Balance: 281.00GEL\n28/09/26 13:47')).toMatchObject({ minor: 28100 });
  expect(parseTbcBalance(DEPOSIT)).toBeNull();
});

test('no SMS with a balance yet: unknown', async () => {
  await sms(DEPOSIT, '2026-10-03T17:16:00');
  expect(await cardBalance()).toBeNull();
});

test('a deposit after the last reported balance is added on top until the next SMS reports it exactly', async () => {
  await sms(SPAR, '2026-10-03T15:19:00');
  expect(await cardBalance()).toMatchObject({ minor: 9114, pending: 0 });

  await sms(DEPOSIT, '2026-10-03T17:16:00');
  expect(await cardBalance()).toMatchObject({ minor: 9114 + 28000, pending: 1 });

  await sms(BAR, '2026-10-03T17:19:00');
  expect(await cardBalance()).toMatchObject({ minor: 28314, pending: 0 });
});

test('a balance-only SMS sets it; an older SMS arriving late does not override a newer balance', async () => {
  await sms('Balance: 500.00GEL\n04/10/26 10:00', '2026-10-04T10:00:00');
  expect(await cardBalance()).toMatchObject({ minor: 50000, pending: 0 });
  await sms(SPAR, '2026-10-03T15:19:00');
  expect(await cardBalance()).toMatchObject({ minor: 50000 });
});

test('manual transactions (cash) don\'t touch the card balance', async () => {
  await sms(SPAR, '2026-10-03T15:19:00');
  await addManualTransaction({ amount_minor: 1000, category_id: null, occurred_at: Math.floor(new Date('2026-10-03T16:00:00').getTime() / 1000) });
  expect(await cardBalance()).toMatchObject({ minor: 9114, pending: 0 });
});

test('first use: the balance is found in transactions already stored', async () => {
  await sms(SPAR, '2026-10-03T15:19:00');
  const { getDb } = require('../src/db');
  await (await getDb()).run("DELETE FROM app_settings WHERE key = 'card_balance'");
  expect(await cardBalance()).toMatchObject({ minor: 9114, pending: 0 });
});
