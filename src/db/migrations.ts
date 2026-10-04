import { Db } from './types';
import { parseTbc } from '../parsers/tbc';
import { REMEMBERABLE_KINDS } from '../types';

/** A migration step: one SQL statement, or a function for data fixes SQL can't express (re-parsing SMS). */
export type MigrationStep = string | ((db: Db) => Promise<void>);

const CARD_NAME_KEY = /^(MC|MASTERCARD|VISA|AMEX|MAESTRO|UNIONPAY)\b/;

/**
 * 9: "MC GOLD" on deposits / transfers / refunds is the card, not a merchant. Re-parse those SMS with the
 * current parser (deposits get the sender as merchant, transfers none, refunds the shop), drop merchant
 * rules on card names, and uncategorize what a rule put on kinds that are never remembered.
 */
async function fixCardMerchants(db: Db) {
  const rows = await db.all<{ id: number; raw_sms: string }>(
    `SELECT id, raw_sms FROM transactions
      WHERE raw_sms != '' AND (kind IN ('deposit', 'transfer', 'refund') OR merchant_key LIKE 'MC %' OR merchant_key LIKE 'VISA%')`);
  for (const r of rows) {
    const p = parseTbc(r.raw_sms);
    if (!p) continue;
    await db.run('UPDATE transactions SET raw_merchant = ?, merchant_key = ? WHERE id = ?',
      [p.raw_merchant || null, p.merchant_key || null, r.id]);
  }
  const rules = await db.all<{ id: number; pattern: string }>('SELECT id, pattern FROM merchant_rules');
  for (const rule of rules) {
    if (CARD_NAME_KEY.test(rule.pattern)) await db.run('DELETE FROM merchant_rules WHERE id = ?', [rule.id]);
  }
  await db.run(
    `UPDATE transactions SET category_id = NULL, category_source = NULL
      WHERE category_source = 'rule' AND kind NOT IN (${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')})`);
}

// Each migration is a list of single statements (quick-sqlite executes one statement per call).
// Append new migrations to the end; never edit ones that have shipped.
// PRAGMA user_version stores how many have been applied.
export const MIGRATIONS: MigrationStep[][] = [
  // 1: initial schema. IF NOT EXISTS / OR IGNORE so dev databases created from the
  // old db/schema.sql (user_version = 0) upgrade cleanly.
  [
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      emoji TEXT,
      sort_order INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS merchant_rules (
      id INTEGER PRIMARY KEY,
      match_type TEXT NOT NULL CHECK (match_type IN ('exact','prefix')),
      pattern TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (match_type, pattern)
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY,
      bank TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      raw_merchant TEXT,
      merchant_key TEXT,
      category_id INTEGER,
      category_source TEXT,
      occurred_at INTEGER NOT NULL,
      raw_sms TEXT NOT NULL,
      sms_hash TEXT NOT NULL UNIQUE
    )`,
    'CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions(occurred_at)',
    'CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_key)',
    `CREATE TABLE IF NOT EXISTS category_usage (
      category_id INTEGER PRIMARY KEY,
      usage_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    )`,
    `INSERT OR IGNORE INTO categories (name, emoji, sort_order) VALUES
      ('Продукты', '🛒', 1),
      ('Кафе и рестораны', '☕️', 2),
      ('Транспорт', '🚌', 3),
      ('Такси', '🚕', 4),
      ('Дом и коммуналка', '🏠', 5),
      ('Здоровье', '⚕️', 6),
      ('Подписки', '📺', 7),
      ('Покупки', '🛍️', 8),
      ('Развлечения', '🎮', 9),
      ('Путешествия', '✈️', 10),
      ('Переводы', '🔁', 11),
      ('Другое', '🔖', 99)`,
  ],
  // 2: monthly spending plan per category. One standing amount, applies to every month.
  [
    `CREATE TABLE IF NOT EXISTS budgets (
      category_id INTEGER PRIMARY KEY,
      limit_minor INTEGER NOT NULL CHECK (limit_minor > 0),
      currency TEXT NOT NULL DEFAULT 'GEL',
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    )`,
  ],
  // 3: per-month plan replaces the standing one. Standing amounts become pinned items of the
  // current month, so they keep carrying over.
  [
    'CREATE TABLE IF NOT EXISTS plan_months (ym TEXT PRIMARY KEY)',
    `CREATE TABLE IF NOT EXISTS plan_items (
      ym TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (limit_minor >= 0),
      pinned INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ym, category_id),
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    )`,
    `INSERT OR IGNORE INTO plan_months (ym)
      SELECT strftime('%Y-%m', 'now', 'localtime') WHERE EXISTS (SELECT 1 FROM budgets)`,
    `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, pinned)
      SELECT strftime('%Y-%m', 'now', 'localtime'), category_id, limit_minor, 1 FROM budgets`,
    'DROP TABLE budgets',
  ],
  // 4: category types ("Переводы: Маме") and soft delete (past months keep the category).
  // categories is rebuilt to drop UNIQUE(name): the same name may exist under different types
  // or as a deleted category; uniqueness among live categories is checked in the app.
  [
    `CREATE TABLE IF NOT EXISTS category_types (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      is_transfer INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    "INSERT INTO category_types (name, is_transfer, sort_order) VALUES ('Переводы', 1, 100)",
    `CREATE TABLE categories_new (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT,
      sort_order INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      type_id INTEGER REFERENCES category_types(id),
      deleted_at INTEGER
    )`,
    'INSERT INTO categories_new (id, name, emoji, sort_order, is_archived) SELECT id, name, emoji, sort_order, is_archived FROM categories',
    'DROP TABLE categories',
    'ALTER TABLE categories_new RENAME TO categories',
    // LIKE only folds ASCII case, hence both spellings
    `UPDATE categories SET type_id = (SELECT id FROM category_types WHERE is_transfer = 1)
      WHERE name LIKE 'Перевод%' OR name LIKE 'перевод%' OR name LIKE 'ПЕРЕВОД%'`,
    // the seeded "Переводы" would read "Переводы: Переводы" with its new type prefix
    `UPDATE categories SET name = 'Прочие'
      WHERE name = 'Переводы' AND type_id = (SELECT id FROM category_types WHERE is_transfer = 1)`,
    // archive is replaced by soft delete
    "UPDATE categories SET deleted_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE is_archived = 1",
  ],
  // 5: read state. NULL = not opened yet (blue dot, tab badge). Everything already stored counts as
  // read, so the badge starts at zero instead of the whole backlog.
  [
    'ALTER TABLE transactions ADD COLUMN seen_at INTEGER',
    "UPDATE transactions SET seen_at = CAST(strftime('%s', 'now') AS INTEGER)",
  ],
  // 6: the amount a month's plan distributes (e.g. salary). NULL = not set, the plan is unbounded.
  [
    'ALTER TABLE plan_months ADD COLUMN budget_minor INTEGER CHECK (budget_minor >= 0)',
  ],
  // 7: plan item kind. 'limit' = a spending cap (progress bar); 'fixed' = a fixed payment such as rent
  // (paid / not paid). Existing items are limits.
  [
    "ALTER TABLE plan_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'limit' CHECK (kind IN ('limit', 'fixed'))",
  ],
  // 8: merchant rules no longer apply to money transfers (their "merchant" is the card type, the same for
  // every transfer). Transfers a rule put into a category go back to uncategorized; manual choices stay.
  [
    "UPDATE transactions SET category_id = NULL, category_source = NULL WHERE kind = 'transfer' AND category_source = 'rule'",
  ],
  [fixCardMerchants],
  // 10: a refund settled against a purchase (the purchase reduced or deleted): when, and which purchase
  [
    'ALTER TABLE transactions ADD COLUMN refund_settled_at INTEGER',
    'ALTER TABLE transactions ADD COLUMN refund_target_id INTEGER',
  ],
  // 11: a free-text note on a transaction, and "handle this one differently": merchant rules neither apply to
  // the transaction nor learn from it
  [
    'ALTER TABLE transactions ADD COLUMN note TEXT',
    'ALTER TABLE transactions ADD COLUMN merchant_detached INTEGER NOT NULL DEFAULT 0',
  ],
  // 12: colors. A type's palette (see src/colors.ts; NULL = by its position), a category's own color (NULL = auto)
  [
    'ALTER TABLE category_types ADD COLUMN palette TEXT',
    'ALTER TABLE categories ADD COLUMN color TEXT',
  ],
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
];

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrate(db: Db, migrations: MigrationStep[][] = MIGRATIONS): Promise<number> {
  const current = await getSchemaVersion(db);
  for (let v = current; v < migrations.length; v++) {
    await db.transaction(async (tx) => {
      for (const step of migrations[v]) {
        if (typeof step === 'string') await tx.run(step);
        else await step(tx);
      }
      // PRAGMA doesn't accept bound parameters; v is always an integer here
      await tx.run(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return migrations.length;
}
