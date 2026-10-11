// Real TBC SMS shapes (amounts / names as sent by the user on 2026-10-03 and 2026-10-11, card digits kept masked).
import { parseTbc, parseTbcBalance } from '../../src/parsers/tbc';

describe('real TBC SMS', () => {
  test('deposit: the card line is not a merchant, the sender after the date is', () => {
    expect(parseTbc('Deposit Money: 1.00 GEL\nMC GOLD\n03/10/2026\nDEMID RIABOV')).toMatchObject({
      kind: 'deposit', amount_minor: 100, raw_merchant: 'DEMID RIABOV', counterparty: 'DEMID RIABOV',
      occurred_at: '2026-10-03T00:00:00',
    });
  });

  test('transfer without a name: no merchant at all (MC GOLD is the card)', () => {
    const p = parseTbc('Money Transfer:\n1.00 GEL\nMC GOLD\n02/10/2026');
    expect(p).toMatchObject({ kind: 'transfer', amount_minor: 100, raw_merchant: '', merchant_key: '' });
    expect(p?.counterparty).toBeUndefined();
  });

  test('payment: merchant is remembered, the ID line is skipped', () => {
    expect(parseTbc('Payment\n25.69GEL\nTELMICO\nID:1951043\n29/09/2026')).toMatchObject({
      kind: 'payment', amount_minor: 2569, raw_merchant: 'TELMICO', merchant_key: 'TELMICO', occurred_at: '2026-09-29T00:00:00',
    });
  });

  test('refund: the merchant comes from "initiated by ..."', () => {
    expect(parseTbc('A refund of 94.78 GEL has been initiated by TEMU.COM to your MC GOLD (*1834). The amount will be credited to your account within 2–5 days. If the amount is not credited within this period, please contact TEMU.COM.'))
      .toMatchObject({ kind: 'refund', amount_minor: 9478, raw_merchant: 'TEMU.COM', merchant_key: 'TEMU COM' });
  });

  test('cash deposit: a deposit in its own currency, no sender (MC GOLD is the card)', () => {
    const p = parseTbc('Cash Deposit: 100.00 USD\nMC GOLD\n20/09/2026');
    expect(p).toMatchObject({ kind: 'deposit', amount_minor: 10000, currency: 'USD', raw_merchant: '', occurred_at: '2026-09-20T00:00:00', has_time: false });
    expect(p?.counterparty).toBeUndefined();
  });

  test('ATM withdrawal without the word "withdrawal": the ATM line makes it one; the balance in another currency', () => {
    const sms = '100.00USD\n(*5772)\nATM TBC-926(Agmash st 61/2)\nBalance: 42.29GEL \n \n11/08/26 17:26';
    expect(parseTbc(sms)).toMatchObject({
      kind: 'withdrawal', amount_minor: 10000, currency: 'USD', raw_merchant: 'ATM TBC-926(Agmash st 61/2)', occurred_at: '2026-08-11T17:26:00',
    });
    expect(parseTbcBalance(sms)).toMatchObject({ minor: 4229, currency: 'GEL', occurred_at: '2026-08-11T17:26:00' });
  });

  test.each([
    ['declined', "89.45 GEL was declined.\nNot enough funds.\n(*'1834')\nWolt\n01/10/26"],
    ['conversion', 'Conversion:\n14.02 USD\n36.40 GEL\nRate: 2.596\n29/09/2026'],
    ['one-time code', 'Code: 195448 27.00 GEL payment ***1834 at BILETEBI'],
  ])('%s is not recorded', (_name, sms) => {
    expect(parseTbc(sms)).toBeNull();
  });
});
