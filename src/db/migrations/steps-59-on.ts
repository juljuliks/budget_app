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

/**
 * 🔒 picked as "MAX" before 60 (or saved after it by a sheet that opened on "MAX" without the flag) is a fixed amount
 * that was all that is free then; the rate moved since. The current and coming months whose 🔒 is all that is free
 * within 1% of the budget (budget − share − planned + the month before's carry, by today's rate) follow it again.
 */
async function lockedMaxAgain(db: Db) {
  const now = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ym = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
  const today = `${ym}-${p2(now.getDate())}`;
  const rate = async (currency: string) => (currency === 'GEL' ? 1 : (await db.get<{ g: number }>(
    'SELECT gel_per_unit AS g FROM fx_rates WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1', [currency, today]))?.g ?? null);
  const months = await db.all<{ ym: string; budget: number; currency: string; pct: number; own: number | null; locked: number }>(
    `SELECT ym, budget_minor AS budget, budget_currency AS currency, unplanned_pct AS pct, unplanned_minor AS own, locked_minor AS locked
      FROM plan_months WHERE ym >= ? AND budget_minor IS NOT NULL AND locked_minor > 0 AND locked_is_max = 0`, [ym]);
  for (const m of months) {
    const to = await rate(m.currency);
    if (!to) continue;
    const inBudget = async (minor: number, currency: string) => {
      const from = await rate(currency);
      return from === null ? null : (minor * from) / to;
    };
    let planned = 0;
    for (const i of await db.all<{ v: number; c: string }>('SELECT limit_minor AS v, currency AS c FROM plan_items WHERE ym = ?', [m.ym])) {
      const v = await inBudget(i.v, i.c);
      if (v === null) { planned = NaN; break; }
      planned += v;
    }
    const [y, mo] = m.ym.split('-').map(Number);
    const before = mo === 1 ? `${y - 1}-12` : `${y}-${p2(mo - 1)}`;
    const carry = await db.get<{ debt: number; plus: number; c: string }>(
      `SELECT carry_debt_minor AS debt, carry_plus_minor AS plus, carry_currency AS c FROM month_closes
        WHERE ym = ? AND closed_at IS NOT NULL AND carry_currency IS NOT NULL`, [before]);
    const carryDelta = carry ? await inBudget(carry.plus - carry.debt, carry.c) : 0;
    const share = m.own ?? m.budget - Math.round((m.budget * (100 - m.pct)) / 100);
    const free = m.budget - share - planned + (carryDelta ?? NaN);
    if (Number.isFinite(free) && free > 0 && Math.abs(free - m.locked) <= m.budget / 100) {
      await db.run('UPDATE plan_months SET locked_minor = 0, locked_is_max = 1 WHERE ym = ?', [m.ym]);
    }
  }
}

/**
 * 63: a coming month made before it began kept what the month before had then (a budget's currency changed later). Such a
 * month follows the one before now (plan_months.follows), its budget always. Those made already, this month on: the
 * budget of the month before when it had none or the same amount in another currency (a funds' items come in each look).
 */
async function followingMonths(db: Db) {
  const now = new Date();
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  type Month = { ym: string; budget_minor: number | null; budget_currency: string; unplanned_pct: number; to_savings: number; locked_minor: number;
    unplanned_minor: number | null; locked_is_max: number };
  const all = await db.all<Month>('SELECT * FROM plan_months ORDER BY ym');
  for (let i = 1; i < all.length; i++) {
    const [before, m] = [all[i - 1], all[i]];
    if (m.ym < nowYm) continue;
    if (before.budget_minor === null) continue;
    if (m.budget_minor === null) {
      Object.assign(m, { ...before, ym: m.ym });
      await db.run(
        `UPDATE plan_months SET budget_minor = ?, budget_currency = ?, unplanned_pct = ?, to_savings = ?, locked_minor = ?, unplanned_minor = ?,
          locked_is_max = ? WHERE ym = ?`,
        [m.budget_minor, m.budget_currency, m.unplanned_pct, m.to_savings, m.locked_minor, m.unplanned_minor, m.locked_is_max, m.ym]);
    } else if (m.budget_minor === before.budget_minor && m.budget_currency !== before.budget_currency) {
      m.budget_currency = before.budget_currency;
      await db.run('UPDATE plan_months SET budget_currency = ? WHERE ym = ?', [m.budget_currency, m.ym]);
    }
  }
}

/** Migrations 59 and on. */
export const STEPS_59_ON: MigrationStep[][] = [
  [glueSecondMerchants],
  // 60: "locked MAX" flag: re-derive the locked amount from the free budget each time, so it follows rate/plan changes
  ['ALTER TABLE plan_months ADD COLUMN locked_is_max INTEGER NOT NULL DEFAULT 0'],
  // 61: "Из сбережений" takes 🔒, then the funds' contributions, then the savings from before. A month closed before
  // keeps what 🔒 alone covered (the rest as answered then) until its overspend is answered again
  [
    'ALTER TABLE month_closes ADD COLUMN locked_cover INTEGER NOT NULL DEFAULT 0',
    'UPDATE month_closes SET locked_cover = 1 WHERE closed_at IS NOT NULL',
  ],
  // 62: a 🔒 that is all that is free (the rate moved it off a little) is "MAX" again: it follows the plan and the rate
  [lockedMaxAgain],
  // 63: a coming month made before it began follows the months before it till changed by hand or begun
  ['ALTER TABLE plan_months ADD COLUMN follows INTEGER NOT NULL DEFAULT 0', followingMonths],
];
