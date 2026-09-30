import crypto from 'crypto';
import { sha256Hex } from '../src/hash';

const node = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('sha256Hex', () => {
  const inputs = [
    '',
    'abc',
    'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), // padding edge cases
    '44.00GEL\n(*XXXX)\nAdamDent LLC\nBalance: 237.00GEL\n28/09/26 13:49TBC SMS',
    'Продукты ☕️ ₾ 🛒', // multi-byte + astral UTF-8
  ];
  test.each(inputs)('matches node crypto for %j', (s) => {
    expect(sha256Hex(s)).toBe(node(s));
  });
});
