jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { assignCategory } from '../../src/categorize/assign';
import * as rules from '../../src/categorize/rules';
import { setMerchantCategory } from '../../src/db/merchants';
import { freshDb } from '../helpers';

// The multi-step writes are all or none: a step failing after the first leaves nothing of the earlier ones.

const insert = async (merchant: string, hash: string) => (await (await getDb()).run(
  `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, occurred_at, raw_sms, sms_hash)
    VALUES ('tbc', 'purchase', 1000, 'GEL', ?, ?, 1000, '', ?)`, [merchant, merchant, hash])).lastInsertRowid;
const rulesOf = async () => (await getDb()).all('SELECT pattern, category_id FROM merchant_rules');
const categories = async () => (await (await getDb()).all<{ c: number | null }>('SELECT category_id AS c FROM transactions ORDER BY id')).map((r) => r.c);

beforeEach(() => freshDb());
afterEach(() => jest.restoreAllMocks());

test('a category for the merchant: the rule, this operation and the others together, or none of them', async () => {
  const a = await insert('SPAR', 'a');
  await insert('SPAR', 'b');
  jest.spyOn(rules, 'backfillRule').mockRejectedValueOnce(new Error('disk full'));
  await expect(assignCategory(a, 3, 'merchant')).rejects.toThrow('disk full');
  expect(await rulesOf()).toEqual([]);
  expect(await categories()).toEqual([null, null]);
  // and once it works, all of it
  await assignCategory(a, 3, 'merchant');
  expect(await rulesOf()).toEqual([{ pattern: 'SPAR', category_id: 3 }]);
  expect(await categories()).toEqual([3, 3]);
});

test('a merchant\'s category from its card: no rule left without its operations', async () => {
  await insert('SPAR', 'a');
  jest.spyOn(rules, 'backfillRule').mockRejectedValueOnce(new Error('disk full'));
  await expect(setMerchantCategory('SPAR', 4)).rejects.toThrow('disk full');
  expect(await rulesOf()).toEqual([]);
  expect(await categories()).toEqual([null]);
});
