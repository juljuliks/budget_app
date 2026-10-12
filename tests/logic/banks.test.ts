// Other banks (domain/banks.ts, db/banks.ts): whose a message is, its templates and balance apart; "Между своими картами".
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import { cardBalance } from '../../src/db/balance';
import { cardBalances, enabledBanks, setBankEnabled } from '../../src/db/banks';
import { listUnparsed } from '../../src/db/messages';
import { monthIncome } from '../../src/db/plans/budget';
import { spendRows } from '../../src/db/plans/spend';
import { banksWithTransactions, listTransactionsFiltered } from '../../src/db/transactions';
import { bankOfSender } from '../../src/domain/banks';
import { ingestSms } from '../../src/ingest/ingest';
import { saveTemplate } from '../../src/ingest/byTemplate';
import { Role, wordsOf } from '../../src/parsers/template';

const marks = (body: string, list: Array<[string, Role]>) => {
  const words = wordsOf(body).map((w) => w.text);
  return Object.fromEntries(list.map(([text, role]) => [words.indexOf(text), role])) as Record<number, Role>;
};
const at = (s: string) => new Date(s).getTime();
// a made-up BoG text: the template reads whatever its words are
const BOG = (amount: string, merchant: string, balance: string) => `Purchase ${amount} GEL ${merchant} Balance ${balance} GEL`;
const TBC_SPAR = '17.69GEL\n(*1834)\nSPAR\nBalance: 91.14GEL\n\n03/10/26 15:19';

beforeEach(() => freshDb());

test('whose a message is: by the SMS sender or the push\'s app; none — TBC\'s, the only bank read before', () => {
  expect(bankOfSender('TBC SMS').id).toBe('tbc');
  expect(bankOfSender('BOG').id).toBe('bog');
  expect(bankOfSender('push:ge.bog.mobilebank').id).toBe('bog');
  expect(bankOfSender('push:ge.tbcbank').id).toBe('tbc');
  expect(bankOfSender('').id).toBe('tbc');
});

test('a bank without a parser: its messages wait in "Не распознано"; a template of them reads only its bank\'s, its balance apart', async () => {
  await ingestSms({ sender: 'TBC SMS', body: TBC_SPAR, timestamp: at('2026-10-03T15:19:10') });
  const first = BOG('12.50', 'CARREFOUR', '812.40');
  expect(await ingestSms({ sender: 'BOG', body: first, timestamp: at('2026-10-12T18:44:00') })).toMatchObject({ kept: 'unparsed' });
  const [kept] = await listUnparsed();
  expect(await saveTemplate(kept, marks(first, [['12.50', 'amount'], ['GEL', 'currency'], ['CARREFOUR', 'merchant'], ['812.40', 'balance']]), 'purchase')).toBe(1);
  await ingestSms({ sender: 'BOG', body: BOG('7.00', 'SPAR', '805.40'), timestamp: at('2026-10-12T19:00:00') });
  // a TBC message of the same shape isn't read by BoG's template
  expect(await ingestSms({ sender: 'TBC SMS', body: BOG('3.00', 'X', '1.00'), timestamp: at('2026-10-12T19:10:00') })).toMatchObject({ kept: 'unparsed' });

  const db = await getDb();
  expect(await db.all("SELECT bank, raw_merchant FROM transactions WHERE bank = 'bog' ORDER BY occurred_at")).toEqual([
    { bank: 'bog', raw_merchant: 'CARREFOUR' }, { bank: 'bog', raw_merchant: 'SPAR' },
  ]);
  expect(await cardBalance('bog')).toMatchObject({ minor: 80540, pending: 0 });
  expect(await cardBalance('tbc')).toMatchObject({ minor: 9114, pending: 0 });
  expect(await banksWithTransactions()).toEqual(expect.arrayContaining([{ bank: 'bog', count: 2 }, { bank: 'tbc', count: 1 }]));
  expect((await listTransactionsFiltered({ banks: ['bog'] })).map((r) => r.raw_merchant)).toEqual(['SPAR', 'CARREFOUR']);

  // the balances shown: the banks on only
  expect((await cardBalances()).map((c) => c.bank)).toEqual(['tbc']);
  await setBankEnabled('bog', true);
  expect((await cardBalances()).map((c) => [c.bank, c.balance.minor])).toEqual([['tbc', 9114], ['bog', 80540]]);
});

test('banks on and off: TBC alone at first; the last one stays on', async () => {
  expect(await enabledBanks()).toEqual(['tbc']);
  expect(await setBankEnabled('bog', true)).toEqual(['tbc', 'bog']);
  expect(await setBankEnabled('tbc', false)).toEqual(['bog']);
  expect(await setBankEnabled('bog', false)).toEqual(['bog']);
});

test('"Между своими картами": a transfer there isn\'t spending, a deposit there isn\'t income', async () => {
  const db = await getDb();
  const own = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'own'"))!.id;
  const ins = (kind: string, amount: number, n: number) => db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', ?, ?, 'GEL', ?, 'user', ?, '', ?)`, [kind, amount, own, Math.floor(at('2026-10-10T12:00:00') / 1000), `o${n}`]);
  await ins('transfer', 20000, 1);
  await ins('deposit', 20000, 2);
  expect(await spendRows(Math.floor(at('2026-10-01T00:00:00') / 1000), Math.floor(at('2026-11-01T00:00:00') / 1000))).toEqual([]);
  expect(await monthIncome('2026-10')).toBe(0);
});
