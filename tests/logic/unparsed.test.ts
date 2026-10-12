// Messages no operation came from: kept in "Не распознано", read by the user's templates (ingest/byTemplate.ts).
import { ingestSms } from '../../src/ingest/ingest';
import { addFromMessage, previewTemplate, saveTemplate } from '../../src/ingest/byTemplate';
import { countUnparsed, deleteTemplates, listTemplates, listUnparsed, UNPARSED_KEEP_S } from '../../src/db/messages';
import { cardBalance } from '../../src/db/balance';
import { getDb } from '../../src/db';
import { Role, wordsOf } from '../../src/parsers/template';
import { freshDb } from '../helpers';

const T0 = new Date(2026, 9, 9, 10, 0).getTime();
const push = (body: string, at = T0) => ingestSms({ sender: 'push:ge.tbcbank', body, timestamp: at, source: 'push' });
const PUSH = (amount: string, cur: string, merchant: string, day: string) =>
  `TBC Bank\nPayment · ${amount} ${cur}, ${merchant}, ${day}.10.2026 10:00. Card *1234. Balance: 2 843.17 GEL`;
const marks = (body: string, list: Array<[string, Role]>) => {
  const words = wordsOf(body).map((w) => w.text);
  return Object.fromEntries(list.map(([text, role]) => [words.indexOf(text), role])) as Record<number, Role>;
};
const MARKS: Array<[string, Role]> = [['45.00', 'amount'], ['GEL', 'currency'], ['FABRIKA', 'merchant'], ['09.10.2026', 'date'], ['10:00', 'date'], ['2 843.17', 'balance']];
const ops = async () => (await getDb()).all<{ raw_merchant: string; amount_minor: number; currency: string; kind: string }>(
  'SELECT raw_merchant, amount_minor, currency, kind FROM transactions ORDER BY occurred_at');

beforeEach(() => freshDb());

test('a bank message nothing read is kept (once); a code, a declined payment are not', async () => {
  expect(await push(PUSH('45.00', 'GEL', 'FABRIKA', '09'))).toEqual({ status: 'ignored', kept: 'unparsed' });
  expect(await push(PUSH('45.00', 'GEL', 'FABRIKA', '09'))).toEqual({ status: 'ignored', kept: 'unparsed' });
  expect(await push('Code: 195448 27.00 GEL payment')).toEqual({ status: 'ignored' });
  expect(await push('Payment declined: insufficient funds')).toEqual({ status: 'ignored' });
  expect((await listUnparsed()).map((m) => [m.source, m.body.split('\n')[1].slice(0, 15)])).toEqual([['push', 'Payment · 45.00']]);
  expect(await ops()).toEqual([]);
});

test('kept 30 days', async () => {
  await push(PUSH('45.00', 'GEL', 'FABRIKA', '09'));
  const now = Math.floor(T0 / 1000);
  expect(await countUnparsed(now + UNPARSED_KEEP_S - 60)).toBe(1);
  expect(await listUnparsed(now + UNPARSED_KEEP_S + 60)).toEqual([]);
});

test('a template: the kept ones like it become operations (with their balance), the new ones are read on arrival', async () => {
  const first = PUSH('45.00', 'GEL', 'FABRIKA', '09');
  await push(first);
  await push(PUSH('12.50', 'USD', 'WOLT GEORGIA', '10'), T0 + 86400e3);
  await push('TBC Bank\nNew offer for you!', T0 + 3600e3);
  const [m] = (await listUnparsed()).filter((x) => x.body === first);
  // the preview: what it would take
  expect((await previewTemplate(m, marks(first, MARKS), 'purchase')).map((p) => p.parsed?.raw_merchant)).toEqual(['WOLT GEORGIA', 'FABRIKA']);
  expect(await saveTemplate(m, marks(first, MARKS), 'purchase')).toBe(2);
  expect(await ops()).toEqual([
    { raw_merchant: 'FABRIKA', amount_minor: 4500, currency: 'GEL', kind: 'purchase' },
    { raw_merchant: 'WOLT GEORGIA', amount_minor: 1250, currency: 'USD', kind: 'purchase' },
  ]);
  expect((await listUnparsed()).map((x) => x.body)).toEqual(['TBC Bank\nNew offer for you!']);
  expect((await cardBalance())?.minor ?? null).not.toBeNull();
  // a new one: read right away, counted
  expect(await push(PUSH('7.00', 'GEL', 'SPAR', '12'), T0 + 3 * 86400e3)).toMatchObject({ status: 'inserted', kind: 'purchase' });
  expect((await listTemplates('push'))[0]).toMatchObject({ action: 'operation', kind: 'purchase', matched: 3 });
  // an SMS like it: templates are per source
  expect(await ingestSms({ sender: 'TBC SMS', body: PUSH('7.00', 'GEL', 'SPAR', '13'), timestamp: T0 })).toEqual({ status: 'ignored', kept: 'unparsed' });
});

test('"hide such": the kept ones like it go, new ones are dropped; the template removed — they are kept again', async () => {
  const code = 'TBC Bank\nYour one-time code is 123456. Do not share it';
  await push(code);
  await push(code.replace('123456', '777777'), T0 + 1000);
  const [m] = await listUnparsed();
  expect(await saveTemplate(m, {}, null)).toBe(2);
  expect(await listUnparsed()).toEqual([]);
  expect(await push(code.replace('123456', '555555'), T0 + 2000)).toEqual({ status: 'ignored', kept: 'hidden' });
  expect(await listUnparsed()).toEqual([]);
  await deleteTemplates(null);
  expect(await push(code.replace('123456', '999999'), T0 + 3000)).toEqual({ status: 'ignored', kept: 'unparsed' });
});

test('"only this operation": no template, it leaves the kept ones; the same message again is a duplicate', async () => {
  const body = PUSH('45.00', 'GEL', 'FABRIKA', '09');
  await push(body);
  const [m] = await listUnparsed();
  expect(await addFromMessage(m, marks(body, MARKS), 'withdrawal')).toMatchObject({ status: 'inserted', kind: 'withdrawal' });
  expect(await listUnparsed()).toEqual([]);
  expect(await listTemplates()).toEqual([]);
  expect(await ops()).toEqual([{ raw_merchant: 'FABRIKA', amount_minor: 4500, currency: 'GEL', kind: 'withdrawal' }]);
  // the bank sent it again: stored once, not kept again
  expect(await push(body)).toMatchObject({ status: 'duplicate' });
  expect(await ops()).toHaveLength(1);
  expect(await listUnparsed()).toEqual([]);
});
