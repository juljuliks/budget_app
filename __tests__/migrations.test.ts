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

  test('a failing migration is rolled back and version is not bumped', async () => {
    const db = openDatabase(':memory:');
    const broken = [...MIGRATIONS, ['CREATE TABLE extra (id INTEGER)', 'NOT VALID SQL']];
    // not .toThrow(): better-sqlite3 errors come from another realm and fail Jest's instanceof Error check
    await expect(migrate(db, broken)).rejects.toHaveProperty('message', expect.stringContaining('syntax error'));
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    expect(await db.get("SELECT name FROM sqlite_master WHERE name = 'extra'")).toBeUndefined();
  });
});
