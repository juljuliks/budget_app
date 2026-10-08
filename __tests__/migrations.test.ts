import { openDatabase } from '../src/db/driver';
import { migrate, getSchemaVersion, MIGRATIONS } from '../src/db/migrations';

describe('migrations', () => {
  test('fresh DB gets full schema, seed categories and version', async () => {
    const db = openDatabase(':memory:');
    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(13); // with the system "Сбережения"
    const tables = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['categories', 'merchant_rules', 'transactions', 'category_usage']));
  });

  test('running twice is a no-op', async () => {
    const db = openDatabase(':memory:');
    await migrate(db);
    await migrate(db);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(13); // with the system "Сбережения"
  });

  test('upgrades a legacy DB created from the old schema.sql (user_version 0, no category_usage)', async () => {
    const db = openDatabase(':memory:');
    await db.run('CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, emoji TEXT, sort_order INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0)');
    await db.run("INSERT INTO categories (name, emoji, sort_order) VALUES ('Продукты', '🛒', 1)");
    await migrate(db);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(13); // with the system "Сбережения"
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
      // (migration 27: a deposit without a category goes to "Пополнение счёта")
      { kind: 'deposit', raw_merchant: 'DEMID RIABOV', merchant_key: 'DEMID RIABOV', category_id: expect.any(Number) },
      { kind: 'transfer', raw_merchant: null, merchant_key: null, category_id: 1 },
    ]);
    expect(await db.all('SELECT pattern FROM merchant_rules')).toEqual([{ pattern: 'SPAR' }]);
  });

  test('migration 15: manual picks equal to the merchant\'s category follow the merchant, others stay manual', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 14));
    await db.run("INSERT INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES ('exact', 'SPAR', 1, 0)");
    const add = (merchant: string, category: number, kind: string, hash: string) => db.run(
      `INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
        VALUES ('TBC', ?, 100, 'GEL', ?, ?, 'user', 1, '', ?)`, [kind, merchant, category, hash]);
    await add('SPAR', 1, 'purchase', 'a'); // made SPAR's category: now follows it
    await add('SPAR', 2, 'purchase', 'b'); // another category for this one only
    await add('WOLT', 1, 'purchase', 'c'); // merchant without a category
    await add('SPAR', 1, 'transfer', 'd'); // transfers never follow a merchant
    await migrate(db);
    expect((await db.all<{ category_source: string }>('SELECT category_source FROM transactions ORDER BY sms_hash')).map((r) => r.category_source))
      .toEqual(['rule', 'user', 'user', 'user']);
  });

  test('a failing migration is rolled back and version is not bumped', async () => {
    const db = openDatabase(':memory:');
    const broken = [...MIGRATIONS, ['CREATE TABLE extra (id INTEGER)', 'NOT VALID SQL']];
    // not .toThrow(): better-sqlite3 errors come from another realm and fail Jest's instanceof Error check
    await expect(migrate(db, broken)).rejects.toHaveProperty('message', expect.stringContaining('syntax error'));
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    expect(await db.get("SELECT name FROM sqlite_master WHERE name = 'extra'")).toBeUndefined();
  });
  test('migration 19: merchant groups are gone, each member keeps the group\'s category; operations stay', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 18));
    await db.run(`INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('TBC', 'purchase', 100, 'GEL', 'SPAR VAKE', 2, 'rule', 1, '', 'a')`);
    await db.run("INSERT INTO merchant_groups (id, name, created_at) VALUES (1, 'SPAR', 0), (2, 'NO CATEGORY', 0)");
    await db.run("INSERT INTO merchant_group_members (merchant_key, group_id) VALUES ('SPAR VAKE', 1), ('SPAR SABURTALO', 1), ('X', 2)");
    await db.run("INSERT INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES ('exact', 'group:1', 2, 5), ('exact', 'WOLT', 3, 5)");
    await migrate(db);
    expect(await db.all('SELECT pattern, category_id FROM merchant_rules ORDER BY pattern')).toEqual([
      { pattern: 'SPAR SABURTALO', category_id: 2 },
      { pattern: 'SPAR VAKE', category_id: 2 },
      { pattern: 'WOLT', category_id: 3 },
    ]);
    expect(await db.get("SELECT name FROM sqlite_master WHERE name LIKE 'merchant_group%'")).toBeUndefined();
    expect(await db.get('SELECT merchant_key, category_id, category_source FROM transactions'))
      .toEqual({ merchant_key: 'SPAR VAKE', category_id: 2, category_source: 'rule' });
  });

  test('migration 24: a refund settled on a reduced purchase gives it its amount back and counts by itself again', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 23));
    const add = async (kind: string, amount: number, category: number | null, hash: string) => (await db.run(
      `INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
        VALUES ('TBC', ?, ?, 'GEL', 'ZARA', ?, ?, 1, '', ?)`, [kind, amount, category, category ? 'user' : null, hash])).lastInsertRowid;
    // 1000 bought, 300 returned: the purchase was reduced to 700
    const purchase = await add('purchase', 700, 8, 'p');
    const reduced = await add('refund', 300, null, 'r1');
    await db.run('UPDATE transactions SET refund_settled_at = 5, refund_target_id = ? WHERE id = ?', [purchase, reduced]);
    // a full refund: its purchase was deleted
    const full = await add('refund', 500, null, 'r2');
    await db.run('UPDATE transactions SET refund_settled_at = 5, refund_target_id = 999 WHERE id = ?', [full]);
    await migrate(db);
    const row = (id: number) => db.get<{ amount_minor: number; category_id: number | null; refund_settled_at: number | null }>(
      'SELECT amount_minor, category_id, refund_settled_at FROM transactions WHERE id = ?', [id]);
    expect(await row(purchase)).toEqual({ amount_minor: 1000, category_id: 8, refund_settled_at: null });
    expect(await row(reduced)).toEqual({ amount_minor: 300, category_id: 8, refund_settled_at: null });
    expect(await row(full)).toEqual({ amount_minor: 500, category_id: null, refund_settled_at: 5 });
  });
});
