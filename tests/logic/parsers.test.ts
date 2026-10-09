import parseTbc from '../../src/parsers/tbc';
import fixtures from '../fixtures/tbc_sms_fixtures.json';

describe('TBC parser fixtures', () => {
  for (const f of fixtures as any[]) {
    test(f.id, () => {
      const parsed = parseTbc(f.raw_sms);
      if (f.expected_parsed === null) {
        expect(parsed).toBeNull();
      } else {
        expect(parsed).not.toBeNull();
        // check core fields
        expect(parsed!.bank).toBe(f.expected_parsed.bank);
        expect(parsed!.kind).toBe(f.expected_parsed.kind);
        expect(parsed!.amount_minor).toBe(f.expected_parsed.amount_minor);
        expect(parsed!.currency).toBe(f.expected_parsed.currency);
        expect(parsed!.merchant_key).toBe(f.expected_parsed.merchant_key);
      }
    });
  }
});
