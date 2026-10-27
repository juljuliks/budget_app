// The schema's history, migration 59 and on (shipped ones are never edited).
import type { Db } from '../types';
import type { MigrationStep } from './step';
import { parseTbc } from '../../parsers/tbc';
import { normalizeMerchant } from '../../parsers/normalize';

/** The seconds a date on the merchant's line used to leave behind: "Wolt :52", "Wolt: 17", "Wolt:17". */
const SECONDS_TAIL = /\s*:\s*\d{2}$/;

/**
 * The name without those seconds. The SMS wins when it parses to the same shop (its spelling), otherwise the
 * stored name with the tail cut off — a message the built-in parser doesn't read still joins its shop.
 */
function merchantWithoutSeconds(raw: string, sms: string): { name: string; key: string } {
  const stripped = raw.replace(SECONDS_TAIL, '').trim();
  const parsedName = (sms ? parseTbc(sms)?.raw_merchant ?? '' : '').trim();
  const name = parsedName && normalizeMerchant(parsedName) === normalizeMerchant(stripped) ? parsedName : stripped;
  return { name, key: normalizeMerchant(name) };
}

/** A category remembered for the split shop follows the joined one; the joined one's own wins. */
async function moveRule(db: Db, from: string, to: string) {
  const rules = await db.all<{ match_type: string }>(
    'SELECT match_type FROM merchant_rules WHERE pattern = ?', [from]);
  for (const rule of rules) {
    const taken = await db.get('SELECT 1 FROM merchant_rules WHERE match_type = ? AND pattern = ?', [rule.match_type, to]);
    if (taken) await db.run('DELETE FROM merchant_rules WHERE match_type = ? AND pattern = ?', [rule.match_type, from]);
    else await db.run('UPDATE merchant_rules SET pattern = ? WHERE match_type = ? AND pattern = ?', [to, rule.match_type, from]);
  }
}

/** Its "разные категории" mark follows too, when the joined shop isn't already marked. */
async function moveMixed(db: Db, from: string, to: string) {
  if (!await db.get('SELECT 1 FROM mixed_merchants WHERE merchant_key = ?', [from])) return;
  if (await db.get('SELECT 1 FROM mixed_merchants WHERE merchant_key = ?', [to])) {
    await db.run('DELETE FROM mixed_merchants WHERE merchant_key = ?', [from]);
  } else {
    await db.run('UPDATE mixed_merchants SET merchant_key = ? WHERE merchant_key = ?', [to, from]);
  }
}

/** Its category list follows. A list already there keeps its order; the rest are appended. */
async function moveCategories(db: Db, from: string, to: string) {
  const rows = await db.all<{ category_id: number }>(
    'SELECT category_id FROM merchant_categories WHERE merchant_key = ? ORDER BY position, category_id', [from]);
  if (rows.length === 0) return;
  const taken = new Set((await db.all<{ category_id: number }>(
    'SELECT category_id FROM merchant_categories WHERE merchant_key = ?', [to])).map((r) => r.category_id));
  if (taken.size === 0) {
    await db.run('UPDATE merchant_categories SET merchant_key = ? WHERE merchant_key = ?', [to, from]);
    return;
  }
  let pos = (await db.get<{ m: number | null }>('SELECT max(position) AS m FROM merchant_categories WHERE merchant_key = ?', [to]))?.m ?? -1;
  for (const r of rows) {
    if (taken.has(r.category_id)) continue;
    await db.run('INSERT INTO merchant_categories (merchant_key, category_id, position) VALUES (?, ?, ?)', [to, r.category_id, ++pos]);
  }
  await db.run('DELETE FROM merchant_categories WHERE merchant_key = ?', [from]);
}

/** Its repeating payment follows, unless the joined shop already has one. */
async function movePayment(db: Db, from: string, to: string) {
  if (await db.get('SELECT 1 FROM recurring_payments WHERE merchant_key = ? AND deleted_at IS NULL', [to])) return;
  await db.run('UPDATE recurring_payments SET merchant_key = ? WHERE merchant_key = ?', [to, from]);
}

/** Rules, lists and payments of a shop that no longer has operations move onto the one it joined. */
async function retarget(db: Db, from: string, to: string) {
  if (!to || await db.get('SELECT 1 FROM transactions WHERE merchant_key = ?', [from])) return;
  await moveRule(db, from, to);
  await moveMixed(db, from, to);
  await moveCategories(db, from, to);
  await movePayment(db, from, to);
}

/**
 * 59: the date on a merchant's line may carry seconds. They used to stay in the name ("Wolt :17", "Wolt :25"),
 * and one shop was stored as many. Cut them off and join those shops ("Wolt").
 */
async function glueSecondMerchants(db: Db) {
  const rows = await db.all<{ id: number; raw_sms: string; raw_merchant: string; merchant_key: string | null }>(
    `SELECT id, raw_sms, raw_merchant, merchant_key FROM transactions
      WHERE raw_merchant GLOB '*:[0-9][0-9]' OR raw_merchant GLOB '*: [0-9][0-9]'`);
  const joined = new Map<string, string>();
  for (const r of rows) {
    if (!SECONDS_TAIL.test(r.raw_merchant)) continue;
    const { name, key } = merchantWithoutSeconds(r.raw_merchant, r.raw_sms ?? '');
    if (name === r.raw_merchant && key === (r.merchant_key ?? '')) continue;
    await db.run('UPDATE transactions SET raw_merchant = ?, merchant_key = ?, search_text = NULL WHERE id = ?',
      [name || null, key || null, r.id]);
    if (r.merchant_key && r.merchant_key !== key) joined.set(r.merchant_key, key);
  }
  for (const [from, to] of joined) await retarget(db, from, to);
}

/** Migrations 59 and on. */
export const STEPS_59_ON: MigrationStep[][] = [
  [glueSecondMerchants],
  // 60: "locked MAX" flag: re-derive the locked amount from the free budget each time, so it follows rate/plan changes
  ['ALTER TABLE plan_months ADD COLUMN locked_is_max INTEGER NOT NULL DEFAULT 0'],
];
