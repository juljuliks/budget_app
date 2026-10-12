// The user's message templates (parsers/template.ts): words marked in one message read the messages like it.
import { balanceByTemplate, buildTemplate, matchTemplate, parseDate, parseNumber, readByTemplate, Role, wordsOf } from '../../src/parsers/template';

const PUSH = 'TBC Bank\nPayment · 45.00 GEL, FABRIKA, 09.10.2026 10:00. Card *1234. Balance: 2 843.17 GEL';
/** marks by the words' texts */
const marks = (body: string, list: Array<[string, Role]>) => {
  const words = wordsOf(body).map((w) => w.text);
  return Object.fromEntries(list.map(([text, role]) => [words.indexOf(text), role])) as Record<number, Role>;
};

test('the words to mark: no punctuation, a number with a space is one, each word once', () => {
  expect(wordsOf(PUSH).map((w) => w.text)).toEqual(
    ['TBC', 'Bank', 'Payment', '45.00', 'GEL', 'FABRIKA', '09.10.2026', '10:00', 'Card', '1234', 'Balance', '2 843.17']);
});

test('numbers and dates as banks write them', () => {
  expect([parseNumber('45.00'), parseNumber('2 843.17'), parseNumber('1,234.56'), parseNumber('12,5'), parseNumber('1500')])
    .toEqual([4500, 284317, 123456, 1250, 150000]);
  expect(parseDate('09.10.2026 10:00')).toEqual({ iso: '2026-10-09T10:00:00', hasTime: true });
  expect(parseDate('9/10/26')).toEqual({ iso: '2026-10-09T00:00:00', hasTime: false });
  expect(parseDate('31.02.2026')).toBeNull();
});

describe('a template from one marked push', () => {
  const spec = buildTemplate(PUSH, marks(PUSH, [
    ['45.00', 'amount'], ['GEL', 'currency'], ['FABRIKA', 'merchant'], ['09.10.2026', 'date'], ['10:00', 'date'], ['2 843.17', 'balance'],
  ]));

  test('reads it: the amount, its currency, the merchant, the date and time', () => {
    expect(readByTemplate(spec, 'purchase', PUSH)).toMatchObject({
      kind: 'purchase', amount_minor: 4500, currency: 'GEL', raw_merchant: 'FABRIKA', merchant_key: 'FABRIKA',
      occurred_at: '2026-10-09T10:00:00', has_time: true,
    });
  });

  test('reads another like it: a merchant of several words, other card digits, another balance and currency', () => {
    const other = 'TBC Bank\nPayment · 12.50 USD, WOLT GEORGIA, 11.10.2026 18:12. Card *9876. Balance: 911.05 GEL';
    expect(readByTemplate(spec, 'purchase', other)).toMatchObject({
      amount_minor: 1250, currency: 'USD', raw_merchant: 'WOLT GEORGIA', merchant_key: 'WOLT', occurred_at: '2026-10-11T18:12:00',
    });
    expect(balanceByTemplate(spec, other)).toEqual({ minor: 91105, currency: 'GEL' });
  });

  test('the card balance it gives (its currency: the word after it)', () => {
    expect(balanceByTemplate(spec, PUSH)).toEqual({ minor: 284317, currency: 'GEL' });
  });

  test('not like it: another text', () => {
    expect(readByTemplate(spec, 'purchase', 'TBC Bank\nYour one-time code is 123456')).toBeNull();
    expect(readByTemplate(spec, 'purchase', PUSH.replace('Payment', 'Refund'))).toBeNull();
  });
});

test('an amount with its currency in one word ("45.00GEL"), no date: the time it came is used later', () => {
  const sms = 'Payment\n45.00GEL\nTELMICO\nID:1951043';
  const spec = buildTemplate(sms, marks(sms, [['45.00GEL', 'amount'], ['TELMICO', 'merchant']]));
  expect(readByTemplate(spec, 'payment', 'Payment\n7.20USD\nMAGTI\nID:22')).toMatchObject({
    amount_minor: 720, currency: 'USD', raw_merchant: 'MAGTI', occurred_at: undefined, has_time: false,
  });
});

test('a word that is twice in the text: its first place is marked', () => {
  const sms = 'Cash withdrawal 200 GEL at TBC ATM. Fee 2 GEL';
  const spec = buildTemplate(sms, marks(sms, [['200', 'amount'], ['GEL', 'currency']]));
  expect(readByTemplate(spec, 'withdrawal', 'Cash withdrawal 50 USD at TBC ATM. Fee 1 GEL')).toMatchObject({ amount_minor: 5000, currency: 'USD' });
});

test('"hide such": the whole text, any number in it', () => {
  const spec = buildTemplate('TBC Bank\nYour one-time code is 123456. Do not share it');
  expect(matchTemplate(spec, 'TBC Bank\nYour one-time code is 987654. Do not share it')).toEqual({});
  expect(matchTemplate(spec, 'TBC Bank\nPayment 45.00 GEL')).toBeNull();
});
