import { ingestSms } from '../../src/ingest';
import { cardBalance } from '../../src/db/balance';
import { parseTbcBalance } from '../../src/parsers/tbc';
import { addManualTransaction } from '../../src/db/transactions';
import { freshDb } from '../helpers';

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
  const { getDb } = require('../../src/db');
  await (await getDb()).run("DELETE FROM app_settings WHERE key = 'card_balance'");
  expect(await cardBalance()).toMatchObject({ minor: 9114, pending: 0 });
});

describe('outgoing transfers', () => {
  const TRANSFER = 'Money Transfer:\n15.00 GEL\nMC GOLD\n03/10/2026\nNINO B';

  test('a transfer after the last reported balance is subtracted (by SMS or by the bank\'s push)', async () => {
    await sms(SPAR, '2026-10-03T15:19:00');
    await sms(TRANSFER, '2026-10-03T16:00:00');
    expect(await cardBalance()).toMatchObject({ minor: 9114 - 1500, pending: 1 });
    await ingestSms({ sender: 'TBC', body: 'Money Transfer:\n5.00 GEL\nMC GOLD\n03/10/2026\nANA K', timestamp: new Date('2026-10-03T16:30:00').getTime(), source: 'push' });
    expect(await cardBalance()).toMatchObject({ minor: 9114 - 1500 - 500, pending: 2 });
  });

  test('a transfer without a name too', async () => {
    await sms(SPAR, '2026-10-03T15:19:00');
    await sms('Money Transfer:\n1.00 GEL\nMC GOLD\n03/10/2026', '2026-10-03T15:40:00');
    expect(await cardBalance()).toMatchObject({ minor: 9114 - 100, pending: 1 });
  });

  test('a transfer the bank reported before the balance is already in it', async () => {
    await sms(TRANSFER, '2026-10-03T15:00:00');
    await sms(SPAR, '2026-10-03T15:19:00');
    expect(await cardBalance()).toMatchObject({ minor: 9114, pending: 0 });
  });
});

describe('an SMS with only a date that came after a balance which already had it', () => {
  const ZOOMART = '30.49GEL\n(*1834)\nLTD ZOOMART\nBalance: 14.07GEL\n\n08/10/26 19:30';
  const DECLINED = "63.34 GEL was declined.\n\nNot enough funds.\n(*'1834')\nCarrefour(GTC)\n08/10/26";
  const CARREFOUR = '63.34GEL\n(*1834)\nCarrefour(GTC)\nBalance: 50.73GEL\n\n08/10/26 20:24';
  const DEMID = 'Deposit Money: 100.00 GEL\nMC GOLD\n08/10/2026\nDEMID RIABOV';
  const at = async (body: string) => (await (await import('../../src/db')).getDb()).get<{ at: number }>(
    'SELECT occurred_at AS at FROM transactions WHERE raw_sms = ?', [body]);

  test('the real evening: 14.07 → −63.34 → 50.73, so the 100 came before; then 280 in, 100 out → 230.73', async () => {
    await sms(ZOOMART, '2026-10-08T19:30:10');
    await sms(DECLINED, '2026-10-08T20:20:00');
    await sms(CARREFOUR, '2026-10-08T20:24:10');
    await sms(DEMID, '2026-10-08T20:25:00');
    expect(await cardBalance()).toMatchObject({ minor: 5073, pending: 0 });
    // in the list too: before the purchase
    expect((await at(DEMID))!.at).toBe(new Date('2026-10-08T20:24:00').getTime() / 1000 - 1);
    await sms('Deposit Money: 280.00 GEL\nMC GOLD\n08/10/2026', '2026-10-08T21:00:00');
    await sms('Money Transfer:\n100.00 GEL\nMC GOLD\n08/10/2026', '2026-10-08T21:10:00');
    expect(await cardBalance()).toMatchObject({ minor: 23073, pending: 2 });
  });

  test('two that together fill the gap: both before it', async () => {
    await sms(ZOOMART, '2026-10-08T19:30:10');
    await sms('63.34GEL\n(*1834)\nCarrefour(GTC)\nBalance: 330.73GEL\n\n08/10/26 20:24', '2026-10-08T20:24:10');
    await sms(DEMID, '2026-10-08T20:25:00');
    await sms('Deposit Money: 280.00 GEL\nMC GOLD\n08/10/2026', '2026-10-08T20:26:00');
    expect(await cardBalance()).toMatchObject({ minor: 33073, pending: 0 });
  });

  test('the balances add up without it: it stays where it came (after them)', async () => {
    await sms(ZOOMART, '2026-10-08T19:30:10');
    await sms('63.34GEL\n(*1834)\nCarrefour(GTC)\nBalance: 50.73GEL\n\n08/10/26 20:24', '2026-10-08T20:24:10');
    await sms('Deposit Money: 100.00 GEL\nMC GOLD\n08/10/2026', '2026-10-08T20:25:00');
    // 14.07 − 63.34 ≠ 50.73 only by the first 100: the second one is new
    await sms('Deposit Money: 100.00 GEL\nMC GOLD\n08/10/2026\nANA K', '2026-10-08T21:00:00');
    expect(await cardBalance()).toMatchObject({ minor: 15073, pending: 1 });
  });
});

test('migration 28: one stored after the balance that had it is put before it', async () => {
  const { openDatabase } = await import('../../src/db/driver');
  const { migrate, MIGRATIONS } = await import('../../src/db/migrations');
  const db = openDatabase(':memory:');
  await migrate(db, MIGRATIONS.slice(0, 27));
  const today = new Date();
  const d = (h: number, m: number) => Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime() / 1000);
  const dd = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
  const yy = String(today.getFullYear()).slice(2);
  const ins = (kind: string, minor: number, at: number, sms: string, n: number) => db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, occurred_at, raw_sms, sms_hash) VALUES ('tbc', ?, ?, 'GEL', ?, ?, ?)`,
    [kind, minor, at, sms, `m${n}`]);
  await ins('purchase', 3049, d(10, 0), `30.49GEL\n(*1834)\nLTD ZOOMART\nBalance: 14.07GEL\n\n${dd}/${yy} 10:00`, 1);
  await ins('purchase', 6334, d(11, 0), `63.34GEL\n(*1834)\nCarrefour(GTC)\nBalance: 50.73GEL\n\n${dd}/${yy} 11:00`, 2);
  await ins('deposit', 10000, d(11, 5), `Deposit Money: 100.00 GEL\nMC GOLD\n${dd}/${today.getFullYear()}\nDEMID RIABOV`, 3);
  await migrate(db);
  expect(await db.get("SELECT occurred_at AS at FROM transactions WHERE kind = 'deposit'")).toEqual({ at: d(11, 0) - 1 });
});
