import { openDatabase } from '../src/db/driver';
import { migrate, getSchemaVersion, MIGRATIONS } from '../src/db/migrations';

describe('migrations', () => {
  test('fresh DB gets full schema, seed categories and version', async () => {
    const db = openDatabase(':memory:');
    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(12);
    const tables = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['categories', 'merchant_rules', 'transactions', 'category_usage']));
  });

  test('running twice is a no-op', async () => {
    const db = openDatabase(':memory:');
    await migrate(db);
    await migrate(db);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(12);
  });

  test('upgrades a legacy DB created from the old schema.sql (user_version 0, no category_usage)', async () => {
    const db = openDatabase(':memory:');
    await db.run('CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, emoji TEXT, sort_order INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0)');
    await db.run("INSERT INTO categories (name, emoji, sort_order) VALUES ('Продукты', '🛒', 1)");
    await migrate(db);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(12);
    expect(await db.get("SELECT name FROM sqlite_master WHERE name = 'category_usage'")).toBeDefined();
  });

  test('migration 8: rule-assigned transfers become uncategorized, manual choices and purchases stay', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 7));
    const add = (kind: string, source: string | null, hash: string) => db.run(
      `INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
        VALUES ('TBC', ?, 100, 'GEL', 'MC GOLD', ?, ?, 1, '', ?)`, [kind, source ? 1 : null, source, hash]);
    await add('transfer', 'rule', 'a');
    await add('transfer', 'user', 'b');
    await add('purchase', 'rule', 'c');
    await migrate(db);
    expect(await db.all('SELECT kind, category_id, category_source FROM transactions ORDER BY sms_hash')).toEqual([
      { kind: 'transfer', category_id: null, category_source: null },
      { kind: 'transfer', category_id: 1, category_source: 'user' },
      { kind: 'purchase', category_id: 1, category_source: 'rule' },
    ]);
  });

  test('migration 9: card names stop being merchants, deposits get the sender, card rules are dropped', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 8));
    const add = (kind: string, sms: string, source: string | null, hash: string) => db.run(
      `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
        VALUES ('tbc', ?, 100, 'GEL', 'MC GOLD', 'MC GOLD', ?, ?, 1, ?, ?)`, [kind, source ? 1 : null, source, sms, hash]);
    await add('deposit', 'Deposit Money: 1.00 GEL\nMC GOLD\n03/10/2026\nDEMID RIABOV', 'rule', 'a');
    await add('transfer', 'Money Transfer:\n1.00 GEL\nMC GOLD\n02/10/2026', 'user', 'b');
    await db.run("INSERT INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES ('exact', 'MC GOLD', 1, 0), ('exact', 'SPAR', 1, 0)");
    await migrate(db);
    expect(await db.all('SELECT kind, raw_merchant, merchant_key, category_id FROM transactions ORDER BY sms_hash')).toEqual([
      { kind: 'deposit', raw_merchant: 'DEMID RIABOV', merchant_key: 'DEMID RIABOV', category_id: null },
      { kind: 'transfer', raw_merchant: null, merchant_key: null, category_id: 1 },
    ]);
    expect(await db.all('SELECT pattern FROM merchant_rules')).toEqual([{ pattern: 'SPAR' }]);
  });

  test('a failing migration is rolled back and version is not bumped', async () => {
    const db = openDatabase(':memory:');
    const broken = [...MIGRATIONS, ['CREATE TABLE extra (id INTEGER)', 'NOT VALID SQL']];
    // not .toThrow(): better-sqlite3 errors come from another realm and fail Jest's instanceof Error check
    await expect(migrate(db, broken)).rejects.toHaveProperty('message', expect.stringContaining('syntax error'));
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    expect(await db.get("SELECT name FROM sqlite_master WHERE name = 'extra'")).toBeUndefined();
  });
});
