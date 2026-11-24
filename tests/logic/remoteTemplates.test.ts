// The bank's templates from Remote Config (parsers/remoteTemplates.ts): checked before use, read after the user's own,
// and the kept messages ("Не распознано") read when they come (ingest/byTemplate.ts readKeptByRemote).
import { ingestSms } from '../../src/ingest/ingest';
import { readKeptByRemote, saveTemplate } from '../../src/ingest/byTemplate';
import { listUnparsed, saveRemoteTemplates } from '../../src/db/messages';
import { getDb } from '../../src/db';
import { buildTemplate, Role, wordsOf } from '../../src/parsers/template';
import { parseRemoteTemplates, RemoteTemplate } from '../../src/parsers/remoteTemplates';
import { freshDb } from '../helpers';

const T0 = new Date(2026, 9, 9, 10, 0).getTime();
const push = (body: string) => ingestSms({ sender: 'push:ge.tbcbank', body, timestamp: T0, source: 'push' });
const PUSH = (amount: string, merchant: string) => `TBC Bank\nPayment · ${amount} GEL, ${merchant}, 09.10.2026 10:00. Card *1234.`;
const marks = (body: string, list: Array<[string, Role]>) => {
  const words = wordsOf(body).map((w) => w.text);
  return Object.fromEntries(list.map(([text, role]) => [words.indexOf(text), role])) as Record<number, Role>;
};
const EXAMPLE = PUSH('45.00', 'FABRIKA');
const MARKS: Array<[string, Role]> = [['45.00', 'amount'], ['GEL', 'currency'], ['FABRIKA', 'merchant'], ['09.10.2026', 'date'], ['10:00', 'date']];
const spec = buildTemplate(EXAMPLE, marks(EXAMPLE, MARKS));
const entry = (over: Record<string, unknown> = {}) => ({
  key: 'tbc-push-payment', source: 'push', bank: 'tbc', action: 'operation', kind: 'payment', pattern: spec.pattern, slots: spec.slots, example: EXAMPLE, ...over,
});
const param = (...templates: unknown[]) => JSON.stringify({ schema: 1, templates });
const ops = async () => (await getDb()).all<{ raw_merchant: string; amount_minor: number; kind: string }>(
  'SELECT raw_merchant, amount_minor, kind FROM transactions ORDER BY id');

beforeEach(() => freshDb());

test('checked: a template that reads its own example is kept, the others dropped with the reason', () => {
  const { templates, dropped } = parseRemoteTemplates(param(
    entry(),
    entry({ key: 'bad-regex', pattern: '(' }),
    entry({ key: 'not-its-example', example: 'Something else entirely' }),
    entry({ key: 'no-amount', slots: ['merchant'], pattern: '^(.+)$' }),
    entry({ key: 'no-kind', kind: 'gift' }),
    { source: 'push' },
  ));
  expect(templates.map((t) => t.key)).toEqual(['tbc-push-payment']);
  expect(dropped).toEqual(['bad-regex: bad pattern', "not-its-example: doesn't read its example", 'no-amount: no amount', 'no-kind: kind', 'no key']);
});

test('another schema or not JSON: nothing taken', () => {
  expect(parseRemoteTemplates(JSON.stringify({ schema: 2, templates: [entry()] }))).toEqual({ templates: [], dropped: ['schema 2'] });
  expect(parseRemoteTemplates('{oops').templates).toEqual([]);
});

const use = async (...entries: unknown[]) => saveRemoteTemplates(parseRemoteTemplates(param(...entries)).templates);

test('a message the built-in parser can\'t read: read by the remote template, not kept', async () => {
  await use(entry());
  expect(await push(PUSH('12.50', 'SPAR'))).toMatchObject({ status: 'inserted' });
  expect(await ops()).toEqual([{ raw_merchant: 'SPAR', amount_minor: 1250, kind: 'payment' }]);
  expect(await listUnparsed()).toEqual([]);
});

test('the user\'s own template goes first', async () => {
  await use(entry());
  // the user marked such messages as refunds
  await saveTemplate({ source: 'push', sender: 'push:ge.tbcbank', body: EXAMPLE }, marks(EXAMPLE, MARKS), 'refund');
  await push(PUSH('12.50', 'SPAR'));
  expect((await ops()).map((o) => o.kind)).toEqual(['refund']);
});

test('a "hide such" remote template: dropped, not kept', async () => {
  const promo = 'TBC Bank\nNew offer: 5% cashback until 31.12.2026';
  const hide = buildTemplate(promo);
  await use({ key: 'tbc-promo', source: 'push', bank: 'tbc', action: 'hide', kind: null, pattern: hide.pattern, slots: hide.slots, example: promo });
  expect(await push(promo)).toEqual({ status: 'ignored', kept: 'hidden' });
  expect(await listUnparsed()).toEqual([]);
});

test('new remote templates read the kept messages; the same ones again — not saved, nothing read', async () => {
  await push(PUSH('12.50', 'SPAR'));
  await push(PUSH('7.00', 'WOLT'));
  expect(await listUnparsed()).toHaveLength(2);
  expect(await use(entry())).toBe(true);
  expect(await readKeptByRemote()).toBe(2);
  expect((await ops()).map((o) => o.raw_merchant).sort()).toEqual(['SPAR', 'WOLT']);
  expect(await listUnparsed()).toEqual([]);
  expect(await use(entry())).toBe(false);
});

test('another source or bank: not used', async () => {
  await use(entry({ source: 'sms' }) as unknown as RemoteTemplate);
  expect(await push(PUSH('12.50', 'SPAR'))).toEqual({ status: 'ignored', kept: 'unparsed' });
});
