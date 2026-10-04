import { ingestSms } from '../src/ingest';
import { importInboxSms } from '../src/importer/inboxImport';
import { cardBalance } from '../src/db/balance';
import { getDb } from '../src/db';
import { freshDb } from './helpers';

const SPAR = '17.69GEL\n(*1834)\nSPAR\nBalance: 91.14GEL\n\n03/10/26 15:19';
const DEPOSIT = 'Deposit Money: 280.00 GEL\nMC GOLD\n03/10/2026';
const BAR = '88.00GEL\n(*1834)\nPATARA BARI\nBalance: 283.14GEL\n\n03/10/26 17:19';
const ms = (iso: string) => new Date(iso).getTime();
const inbox = (body: string, iso: string, sentShift = 0) =>
  ({ sender: 'TBC SMS', body, date: ms(iso) + 3000, dateSent: ms(iso) + sentShift });
const count = async () => (await (await getDb()).get<{ n: number }>('SELECT count(*) AS n FROM transactions'))!.n;

beforeEach(() => freshDb());

test('past SMS become transactions; the card balance comes with them', async () => {
  const r = await importInboxSms([
    inbox(SPAR, '2026-10-03T15:19:00'),
    inbox(DEPOSIT, '2026-10-03T17:16:00'),
    inbox(BAR, '2026-10-03T17:19:00'),
    inbox('Balance: 283.14GEL\n03/10/26 17:20', '2026-10-03T17:20:00'),
  ]);
  expect(r).toEqual({ inserted: 3, duplicate: 0, ignored: 1 });
  expect(await count()).toBe(3);
  expect(await cardBalance()).toMatchObject({ minor: 28314, pending: 0 });
});

test('importing twice, or SMS already received live, adds nothing', async () => {
  // received live: the receiver passes the service-centre time, the inbox has it as date_sent
  await ingestSms({ sender: 'TBC SMS', body: SPAR, timestamp: ms('2026-10-03T15:19:00') });
  const first = await importInboxSms([inbox(SPAR, '2026-10-03T15:19:00'), inbox(BAR, '2026-10-03T17:19:00')]);
  expect(first).toEqual({ inserted: 1, duplicate: 1, ignored: 0 });
  // a device reporting another time for the same SMS: caught by the text
  const again = await importInboxSms([inbox(SPAR, '2026-10-03T15:19:00', 7000), inbox(BAR, '2026-10-03T17:19:00')]);
  expect(again).toEqual({ inserted: 0, duplicate: 2, ignored: 0 });
  expect(await count()).toBe(2);
});

test('an operation stored first by push is not doubled by its SMS', async () => {
  await ingestSms({ sender: 'push:ge.tbcbank', body: 'TBC Bank\n88.00GEL\n(*1834)\nPATARA BARI\n03/10/26 17:19', timestamp: ms('2026-10-03T17:19:30'), source: 'push' });
  const r = await importInboxSms([inbox(BAR, '2026-10-03T17:19:00')]);
  expect(r.inserted).toBe(0);
  expect(await count()).toBe(1);
  // and its balance is taken
  expect(await cardBalance()).toMatchObject({ minor: 28314, pending: 0 });
});
