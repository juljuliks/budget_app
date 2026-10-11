// The schema's history, migrations 13 and on (shipped ones are never edited).
import { REMEMBERABLE_KINDS } from '../../domain/types';
import type { MigrationStep } from './step';

/** Migrations 13 and on: a new one is appended here (when this file nears 250 lines, the next file starts). */
export const STEPS_13_ON: MigrationStep[][] = [
  // 13: where a transaction came from ('sms' / 'push' from the bank app), and small app settings
  [
    "ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'sms'",
    'CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)',
  ],
  // 14: no more detaching a transaction from its merchant (any transaction can simply get a category of its
  // own). Detached ones keep their category as a manual choice, which rules never overwrite; the column stays unused
  [
    "UPDATE transactions SET category_source = 'user' WHERE merchant_detached = 1 AND category_id IS NOT NULL",
  ],
  // 15: until now picking a category always marked the transaction as a manual choice, even when that pick made
  // it the merchant's category; so it didn't follow when the merchant's category changed. Purchases / payments
  // that have their merchant's category follow the merchant from now on
  [
    `UPDATE transactions SET category_source = 'rule'
      WHERE category_source = 'user' AND kind IN ('purchase', 'payment') AND merchant_key IS NOT NULL
        AND category_id = (SELECT r.category_id FROM merchant_rules r WHERE r.match_type = 'exact' AND r.pattern = transactions.merchant_key)`,
  ],
  // 16: merchant groups ("SPAR VAKE" + "SPAR SABURTALO" = "SPAR"): a group acts as one merchant (one category,
  // one filter chip) under a name the user picks; its members keep their own merchant_key on transactions.
  // A group's merchant id is 'group:<id>' (merchant keys are upper case, so it can't clash) - see src/db/merchants.ts
  [
    `CREATE TABLE IF NOT EXISTS merchant_groups (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS merchant_group_members (
      merchant_key TEXT PRIMARY KEY,
      group_id INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS merchant_group_members_group ON merchant_group_members (group_id)',
  ],
  // 17: currencies. Official daily rates (GEL per unit, from the National Bank of Georgia, see src/db/fx.ts) for
  // converting stats; the amount to distribute and every plan item have a currency of their own
  [
    `CREATE TABLE IF NOT EXISTS fx_rates (
      date TEXT NOT NULL,
      currency TEXT NOT NULL,
      gel_per_unit REAL NOT NULL,
      PRIMARY KEY (date, currency)
    )`,
    "ALTER TABLE plan_months ADD COLUMN budget_currency TEXT NOT NULL DEFAULT 'GEL'",
    "ALTER TABLE plan_items ADD COLUMN currency TEXT NOT NULL DEFAULT 'GEL'",
  ],
  // 18: how a flexible plan item's norm is counted in period stats: per day, week, two weeks or month
  [
    "ALTER TABLE plan_items ADD COLUMN norm_period TEXT NOT NULL DEFAULT 'day' CHECK (norm_period IN ('day', 'week', '2weeks', 'month'))",
  ],
  // 19: no more merchant groups (the merchants screen lists them by category instead). Each member becomes a
  // merchant of its own with the group's category; operations don't change.
  [
    `INSERT OR REPLACE INTO merchant_rules (match_type, pattern, category_id, created_at)
      SELECT 'exact', gm.merchant_key, r.category_id, r.created_at FROM merchant_group_members gm
        JOIN merchant_rules r ON r.match_type = 'exact' AND r.pattern = 'group:' || gm.group_id`,
    "DELETE FROM merchant_rules WHERE match_type = 'exact' AND pattern LIKE 'group:%'",
    'DROP TABLE IF EXISTS merchant_group_members',
    'DROP TABLE IF EXISTS merchant_groups',
  ],
  // 20: the share of the amount to distribute set aside for spending outside the plan (0–50%): the plan can't take it
  [
    'ALTER TABLE plan_months ADD COLUMN unplanned_pct INTEGER NOT NULL DEFAULT 0 CHECK (unplanned_pct BETWEEN 0 AND 100)',
  ],
  // 21: savings. A system category (categories.system = 'savings', one, can't be deleted or renamed): what the budget
  // leaves (not planned, not spent) goes there, and an operation in it is money put aside, not spending. A category
  // already named "Сбережения" becomes it. Whether the month's leftover goes to savings: plan_months.to_savings
  [
    'ALTER TABLE categories ADD COLUMN system TEXT',
    async (db) => {
      const own = await db.get<{ id: number }>(
        "SELECT id FROM categories WHERE deleted_at IS NULL AND lower(name) IN ('сбережения', 'накопления') ORDER BY id LIMIT 1");
      if (own) await db.run("UPDATE categories SET system = 'savings' WHERE id = ?", [own.id]);
      else {
        await db.run(
          `INSERT INTO categories (name, emoji, system, sort_order)
            VALUES ('Сбережения', '🏦', 'savings', 100)`); // last, after the seeded "Другое" (99)
      }
    },
    'CREATE UNIQUE INDEX IF NOT EXISTS categories_system ON categories(system) WHERE system IS NOT NULL',
    'ALTER TABLE plan_months ADD COLUMN to_savings INTEGER NOT NULL DEFAULT 1',
  ],
  // 22: money locked for savings right away, in the budget's currency: neither the plan nor the share outside it can take it
  [
    'ALTER TABLE plan_months ADD COLUMN locked_minor INTEGER NOT NULL DEFAULT 0 CHECK (locked_minor >= 0)',
  ],
  // 23: the share outside the plan as an amount of one's own (in the budget's currency) instead of a % of it; null = by %
  [
    'ALTER TABLE plan_months ADD COLUMN unplanned_minor INTEGER CHECK (unplanned_minor >= 0)',
  ],
  // 24: refunds are no longer settled on a purchase (they're subtracted from the merchant's category). One settled
  // earlier on a purchase it reduced (the purchase still there, same currency): the purchase gets its amount back, the
  // refund counts by itself again in the purchase's category — the same total. One whose purchase was deleted (a full
  // refund) stays settled: there's nothing left to subtract it from.
  [
    `UPDATE transactions SET amount_minor = amount_minor + (
        SELECT r.amount_minor FROM transactions r
          WHERE r.kind = 'refund' AND r.refund_settled_at IS NOT NULL AND r.refund_target_id = transactions.id
            AND r.currency = transactions.currency)
      WHERE id IN (SELECT r.refund_target_id FROM transactions r
        JOIN transactions p ON p.id = r.refund_target_id AND p.currency = r.currency
        WHERE r.kind = 'refund' AND r.refund_settled_at IS NOT NULL)`,
    `UPDATE transactions SET
        category_id = coalesce(category_id, (SELECT p.category_id FROM transactions p WHERE p.id = transactions.refund_target_id)),
        category_source = CASE WHEN category_id IS NULL AND (SELECT p.category_id FROM transactions p WHERE p.id = transactions.refund_target_id) IS NOT NULL
          THEN 'rule' ELSE category_source END,
        refund_settled_at = NULL, refund_target_id = NULL
      WHERE kind = 'refund' AND refund_settled_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM transactions p WHERE p.id = transactions.refund_target_id AND p.currency = transactions.currency)`,
  ],
  // 25: merchants whose operations are of different categories (a delivery: groceries or ready meals): no category of
  // their own, each new operation asks, offering the categories it already had
  [
    `CREATE TABLE IF NOT EXISTS mixed_merchants (
      merchant_key TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    )`,
  ],
  // 26: such a merchant's own list of categories (offered for its operations): filled with the ones its operations
  // had when marked, then with every one picked for them; added and removed by hand in its card. Kept when unmarked.
  [
    `CREATE TABLE IF NOT EXISTS merchant_categories (
      merchant_key TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (merchant_key, category_id)
    )`,
    `INSERT OR IGNORE INTO merchant_categories (merchant_key, category_id)
      SELECT DISTINCT t.merchant_key, t.category_id FROM transactions t JOIN mixed_merchants m ON m.merchant_key = t.merchant_key
        WHERE t.category_id IS NOT NULL AND t.kind IN (${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')})`,
  ],
  // 27: "Пополнение счёта" (categories.system = 'topup'): every deposit goes there by default — money that came to the
  // card, what the month has to distribute, not spending. Deposits without a category get it. The seeded transfer
  // category "Прочие" goes, its history too: its deposits to "Пополнение счёта", the rest without a category.
  [
    `INSERT INTO categories (name, emoji, system, sort_order) VALUES ('Пополнение счёта', '💳', 'topup', 101)`,
    `UPDATE transactions SET category_id = (SELECT id FROM categories WHERE system = 'topup'), category_source = NULL
      WHERE kind = 'deposit' AND category_id IS NULL`,
    async (db) => {
      const others = await db.all<{ id: number }>(
        `SELECT c.id FROM categories c JOIN category_types t ON t.id = c.type_id
          WHERE t.is_transfer = 1 AND c.name = 'Прочие' AND c.system IS NULL`);
      for (const { id } of others) {
        await db.run(
          `UPDATE transactions SET category_id = (SELECT id FROM categories WHERE system = 'topup'), category_source = NULL
            WHERE category_id = ? AND kind = 'deposit'`, [id]);
        await db.run('UPDATE transactions SET category_id = NULL, category_source = NULL WHERE category_id = ?', [id]);
        for (const table of ['plan_items', 'merchant_rules', 'merchant_categories', 'category_usage']) {
          await db.run(`DELETE FROM ${table} WHERE category_id = ?`, [id]);
        }
        await db.run('DELETE FROM categories WHERE id = ?', [id]);
      }
    },
  ],
  // 28: deposits / transfers with only a date that came after an SMS whose balance already had them (the last month's):
  // put before it, as new ones are (balance.ts placeByBalances) — the card balance counted them twice
  [
    async (db) => {
      const { placeByBalances } = require('../balance') as typeof import('../balance');
      const rows = await db.all<{ id: number }>(
        `SELECT id FROM transactions WHERE bank != 'manual' AND kind IN ('deposit', 'transfer', 'withdrawal')
          AND occurred_at >= CAST(strftime('%s', 'now') AS INTEGER) - 31 * 86400 ORDER BY occurred_at, id`);
      for (const { id } of rows) await placeByBalances(id, db);
    },
  ],
  // 29: indexes for the stats, the merchants and the refunds: a category's operations, a merchant's by date (it covers
  // merchant_key alone, so that one goes), the refunds not settled yet
  [
    'CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_tx_merchant_occurred ON transactions(merchant_key, occurred_at)',
    'DROP INDEX IF EXISTS idx_tx_merchant',
    'CREATE INDEX IF NOT EXISTS idx_tx_kind_refund ON transactions(kind, refund_settled_at)',
  ],
];
