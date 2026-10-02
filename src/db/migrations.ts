import { Db } from './types';

// Each migration is a list of single statements (quick-sqlite executes one statement per call).
// Append new migrations to the end; never edit ones that have shipped.
// PRAGMA user_version stores how many have been applied.
export const MIGRATIONS: string[][] = [
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
];

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrate(db: Db, migrations: string[][] = MIGRATIONS): Promise<number> {
  const current = await getSchemaVersion(db);
  for (let v = current; v < migrations.length; v++) {
    await db.transaction(async () => {
      for (const sql of migrations[v]) await db.run(sql);
      // PRAGMA doesn't accept bound parameters; v is always an integer here
      await db.run(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return migrations.length;
}
