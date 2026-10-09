import parseTbc from '../../src/parsers/tbc';
import { normalizeMerchant } from '../../src/normalize';
import { resolveOccurredAt } from '../../src/ingest';

const purchase = (amountLine: string, merchant = 'SPAR', date = '28/09/26 13:49') =>
  `${amountLine}\n(*XXXX)\n${merchant}\nBalance: 10.00GEL\n${date}`;

describe('amounts', () => {
  test.each([
    ['44.00GEL', 4400, 'GEL'],
    ['1,234.56GEL', 123456, 'GEL'],          // thousands separator (was parsed as 1.23)
    ['12,345,678.90 GEL', 1234567890, 'GEL'],
    ['1 234.56 GEL', 123456, 'GEL'],    // no-break space as thousands separator
    ['100 GEL', 10000, 'GEL'],               // no decimals (was dropped)
    ['12,50GEL', 1250, 'GEL'],               // decimal comma
    ['1,5 GEL', 150, 'GEL'],
    ['5.00₾', 500, 'GEL'],                   // symbol -> ISO code
    ['$9.99', 999, 'USD'],                   // currency before amount
    ['€ 3.20', 320, 'EUR'],
    ['9.99 usd', 999, 'USD'],
  ])('%s -> %i %s', (line, minor, currency) => {
    const p = parseTbc(purchase(line))!;
    expect(p).not.toBeNull();
    expect(p.amount_minor).toBe(minor);
    expect(p.currency).toBe(currency);
  });

  test('balance amount is not taken as the transaction amount', () => {
    expect(parseTbc('Balance: 281.00GEL\n28/09/26 13:47')).toBeNull();
    expect(parseTbc(purchase('7.00GEL'))!.amount_minor).toBe(700);
  });

  test('zero or missing amount is not a transaction', () => {
    expect(parseTbc('Deposit Money:\nMC GOLD\n28/09/2026')).toBeNull();
    expect(parseTbc(purchase('0.00GEL'))).toBeNull();
  });
});

describe('what is (not) a transaction', () => {
  test.each([
    ['personal SMS with a number', 'Привет! Встречаемся в 19.30 у метро'],
    ['personal SMS with money but no card mask', 'Верни 50 GEL до пятницы'],
    ['promo', 'TBC: cashback 5.00 GEL on all purchases until 30/09/26!'],
    ['declined', 'Declined: 50.00GEL\n(*XXXX)\nSPAR\nInsufficient funds\n28/09/26 13:49'],
    ['declined (ru)', '50.00GEL\n(*XXXX)\nSPAR\nОперация отклонена\n28/09/26 13:49'],
  ])('%s -> null', (_name, sms) => {
    expect(parseTbc(sms)).toBeNull();
  });

  test.each([
    ['Refund: 12.00GEL\n(*XXXX)\nSPAR\n28/09/26 13:49', 'refund'],
    ['Cash withdrawal 100.00 GEL\n(*XXXX)\nATM TBC VAKE\n28/09/26 13:49', 'withdrawal'],
    ['Money Transfer: 80.00 GEL\nMC GOLD\n28/09/2026', 'transfer'],
    ['Deposit Money: 280.00 GEL\nMC GOLD\n28/09/2026', 'deposit'],
  ])('%j -> %s', (sms, kind) => {
    expect(parseTbc(sms)!.kind).toBe(kind);
  });
});

describe('merchant', () => {
  test.each([
    ['LTD KEEPZ.ME*YANDEX GO', 'YANDEX GO'],     // gateway prefix
    ['AMZN Mktp US*2K3AB', 'AMZN Mktp US'],      // order id suffix
    ['TBCTPBUS 28/09/26 14:08', 'TBCTPBUS'],     // date on the same line
  ])('%s -> %s', (line, merchant) => {
    expect(parseTbc(purchase('1.00GEL', line))!.raw_merchant).toBe(merchant);
  });

  test('missing merchant line gives empty merchant, not the date', () => {
    const p = parseTbc('44.00GEL\n(*XXXX)\nBalance: 237.00GEL\n28/09/26 13:49')!;
    expect(p.raw_merchant).toBe('');
    expect(p.merchant_key).toBe('');
  });
});

describe('dates', () => {
  test('date with time', () => {
    const p = parseTbc(purchase('1.00GEL'))!;
    expect(p).toMatchObject({ occurred_at: '2026-09-28T13:49:00', has_time: true });
  });

  test('date only', () => {
    expect(parseTbc('Money Transfer: 80.00 GEL\nMC GOLD\n28/09/2026')).toMatchObject({ occurred_at: '2026-09-28T00:00:00', has_time: false });
  });

  test('impossible date is dropped instead of rolling over (31/02 -> 3 March)', () => {
    const p = parseTbc(purchase('1.00GEL', 'SPAR', '31/02/26 13:49'))!;
    expect(p.occurred_at).toBeUndefined();
  });
});

describe('resolveOccurredAt', () => {
  const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
  const sec = (ms: number) => Math.floor(ms / 1000);

  test('time from the SMS text wins', () => {
    expect(resolveOccurredAt({ occurred_at: '2026-09-28T13:49:00', has_time: true }, local(2026, 9, 28, 13, 50)))
      .toBe(sec(local(2026, 9, 28, 13, 49)));
  });

  test('date-only SMS takes the receive time from the same day', () => {
    expect(resolveOccurredAt({ occurred_at: '2026-09-28T00:00:00', has_time: false }, local(2026, 9, 28, 18, 5)))
      .toBe(sec(local(2026, 9, 28, 18, 5)));
  });

  test('date-only SMS received on another day keeps its own date', () => {
    expect(resolveOccurredAt({ occurred_at: '2026-09-28T00:00:00', has_time: false }, local(2026, 9, 29, 9, 0)))
      .toBe(sec(local(2026, 9, 28)));
  });

  test('no date: receive time, else now', () => {
    expect(resolveOccurredAt({ has_time: false }, local(2026, 9, 28, 10, 0))).toBe(sec(local(2026, 9, 28, 10, 0)));
    expect(resolveOccurredAt({ has_time: false }, undefined, local(2026, 1, 1))).toBe(sec(local(2026, 1, 1)));
  });
});

describe('normalizeMerchant', () => {
  test.each([
    ['SPAR.', 'SPAR'],                       // no trailing space (was "SPAR ")
    ['*SPAR*', 'SPAR'],
    ['SPAR 123', 'SPAR'],                    // branch number
    ['SPAR #45 TBILISI GE', 'SPAR'],
    ['GOODWILL TBILISI MALL', 'GOODWILL TBILISI MALL'], // city only stripped at the end
    ['TBILISI', 'TBILISI'],                  // never strip to empty
    ['7 ELEVEN', '7 ELEVEN'],
    ['NETFLIX.COM', 'NETFLIX COM'],
    ['AdamDent LLC', 'ADAMDENT LLC'],
  ])('%s -> %s', (raw, key) => {
    expect(normalizeMerchant(raw)).toBe(key);
  });
});
