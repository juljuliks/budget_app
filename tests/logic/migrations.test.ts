import { openDatabase } from '../../src/db/driver';
import { migrate, getSchemaVersion, MIGRATIONS } from '../../src/db/migrations';

describe('migrations', () => {
  test('fresh DB gets full schema, seed categories and version', async () => {
    const db = openDatabase(':memory:');
    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(MIGRATIONS.length);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(13); // with the system ones: "Между своими картами", "Подписки" (seeded, made system)
    const tables = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['categories', 'merchant_rules', 'transactions', 'category_usage']));
  });

  test('the operations\' indexes: by category, by merchant and date, the refunds; the lookups use them', async () => {
    const db = openDatabase(':memory:');
    await migrate(db);
    const indexes = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transactions'")).map((r) => r.name);
    expect(indexes).toEqual(expect.arrayContaining(['idx_tx_occurred', 'idx_tx_category', 'idx_tx_merchant_occurred', 'idx_tx_kind_refund']));
    expect(indexes).not.toContain('idx_tx_merchant');
    const plan = async (sql: string) => (await db.all<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`)).map((r) => r.detail).join('; ');
    expect(await plan('SELECT id FROM transactions WHERE category_id = 3')).toContain('idx_tx_category');
    expect(await plan("SELECT id FROM transactions WHERE merchant_key = 'x' ORDER BY occurred_at DESC")).toContain('idx_tx_merchant_occurred');
    expect(await plan("SELECT id FROM transactions WHERE kind = 'refund' AND refund_settled_at IS NULL")).toContain('idx_tx_kind_refund');
  });

  test('running twice is a no-op', async () => {
    const db = openDatabase(':memory:');
    await migrate(db);
    await migrate(db);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(13); // with the system ones: "Между своими картами", "Подписки" (seeded, made system)
  });

  test('upgrades a legacy DB created from the old schema.sql (user_version 0, no category_usage)', async () => {
    const db = openDatabase(':memory:');
    await db.run('CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, emoji TEXT, sort_order INTEGER DEFAULT 0, is_archived INTEGER DEFAULT 0)');
    await db.run("INSERT INTO categories (name, emoji, sort_order) VALUES ('Продукты', '🛒', 1)");
    await migrate(db);
    const { n } = (await db.get<{ n: number }>('SELECT count(*) AS n FROM categories'))!;
    expect(n).toBe(13); // with the system ones: "Между своими картами", "Подписки" (seeded, made system)
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

  test('migration 31: a manual operation\'s description moves into its note (before a note it had), a bank one\'s merchant stays', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 30));
    const add = (bank: string, merchant: string | null, note: string | null, hash: string) => db.run(
      `INSERT INTO transactions (bank, kind, amount_minor, currency, raw_merchant, note, occurred_at, raw_sms, sms_hash, search_text)
        VALUES (?, 'purchase', 100, 'GEL', ?, ?, 1, '', ?, 'x')`, [bank, merchant, note, hash]);
    await add('manual', 'Рынок', null, 'a');
    await add('manual', 'Рынок', 'для дачи', 'b');
    await add('manual', null, 'кофе', 'c');
    await add('TBC', 'SPAR', 'вино', 'd');
    await migrate(db);
    expect(await db.all('SELECT raw_merchant AS m, note, search_text AS s FROM transactions ORDER BY sms_hash')).toEqual([
      { m: null, note: 'Рынок', s: null },
      { m: null, note: 'Рынок\nдля дачи', s: null },
      { m: null, note: 'кофе', s: 'x' },
      { m: 'SPAR', note: 'вино', s: 'x' },
    ]);
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
  test('migration 38: the months before this one are closed — the leftover as the switch had it, the contributions as planned', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 37));
    await db.run("INSERT INTO plan_months (ym, budget_minor, to_savings) VALUES ('2026-08', 100000, 0), ('2026-09', 100000, 1), ('2026-10', 100000, 1)");
    await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind) VALUES ('2026-09', 1, 5000, 'fund'), ('2026-10', 1, 6000, 'fund')");
    await migrate(db);
    jest.useRealTimers();
    expect(await db.all('SELECT ym, rest_choice, closed_at IS NOT NULL AS closed FROM month_closes ORDER BY ym')).toEqual([
      { ym: '2026-08', rest_choice: 'keep', closed: 1 },
      { ym: '2026-09', rest_choice: 'savings', closed: 1 },
    ]);
    expect(await db.all('SELECT ym, saved_minor FROM fund_confirms')).toEqual([{ ym: '2026-09', saved_minor: 5000 }]);
  });

  test('migration 40: "Сбережения" is gone — its operations, a split\'s part, rules and merchants in "Между своими картами"', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 39));
    const id = async (system: string) => (await db.get<{ id: number }>('SELECT id FROM categories WHERE system = ?', [system]))!.id;
    const savings = await id('savings');
    const own = await id('own');
    const tx = (key: string, category: number) => db.run(
      `INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
        VALUES ('tbc', 'transfer', 10000, 'GEL', ?, ?, 'user', 0, '', ?)`, [key, category, key]);
    await tx('DEPOSIT', savings);
    await tx('SPLIT', 1);
    await db.run('INSERT INTO transaction_parts (tx_id, category_id, amount_minor) VALUES (2, ?, 4000)', [savings]);
    await db.run("INSERT INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES ('exact', 'DEPOSIT', ?, 0)", [savings]);
    await db.run('INSERT INTO category_usage (category_id, usage_count) VALUES (?, 3)', [savings]);
    await migrate(db);
    expect(await db.get("SELECT 1 FROM categories WHERE system = 'savings'")).toBeUndefined();
    expect(await db.all('SELECT merchant_key, category_id FROM transactions ORDER BY id')).toEqual([
      { merchant_key: 'DEPOSIT', category_id: own }, { merchant_key: 'SPLIT', category_id: 1 },
    ]);
    expect(await db.all('SELECT tx_id, category_id, amount_minor FROM transaction_parts')).toEqual([{ tx_id: 2, category_id: own, amount_minor: 4000 }]);
    expect(await db.all('SELECT pattern, category_id FROM merchant_rules')).toEqual([{ pattern: 'DEPOSIT', category_id: own }]);
    expect(await db.get('SELECT usage_count FROM category_usage WHERE category_id = ?', [own])).toEqual({ usage_count: 3 });
  });

  test('migration 42: "Подписки" is no longer a system category — repeating payments on, its subscriptions its own', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 41));
    const subs = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'subs'"))!.id;
    await db.run("INSERT INTO subscriptions (merchant_key, name, amount_minor, currency, since_ym, created_at) VALUES ('NETFLIX.COM', 'Netflix', 3000, 'GEL', '2026-10', 0)");
    await migrate(db);
    expect(await db.get('SELECT system, recurring FROM categories WHERE id = ?', [subs])).toEqual({ system: null, recurring: 1 });
    expect(await db.get('SELECT category_id FROM recurring_payments')).toEqual({ category_id: subs });
    expect(await db.get('SELECT count(*) AS n FROM categories WHERE recurring = 1')).toEqual({ n: 1 });
  });

  test('migration 43: the tables renamed to repeating payments, a saving\'s sub_id → payment_id; one renamed before — left as it is', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 42));
    await db.run("INSERT INTO subscriptions (merchant_key, name, amount_minor, currency, since_ym, created_at) VALUES ('ICLOUD', 'iCloud+', 10000, 'GEL', '2026-10', 0)");
    await db.run("INSERT INTO sub_savings (id, sub_id, since_ym, start_minor) VALUES (3, 1, '2026-10', 500)");
    await db.run("INSERT INTO sub_contributions (saving_id, ym, minor) VALUES (3, '2026-10', 900)");
    await migrate(db);
    expect(await db.get('SELECT name FROM recurring_payments')).toEqual({ name: 'iCloud+' });
    expect(await db.get('SELECT id, payment_id, start_minor FROM payment_savings')).toEqual({ id: 3, payment_id: 1, start_minor: 500 });
    expect(await db.get('SELECT minor FROM payment_contributions')).toEqual({ minor: 900 });

    const early = openDatabase(':memory:');
    await migrate(early, MIGRATIONS.slice(0, 42));
    await early.run('ALTER TABLE subscriptions RENAME TO recurring_payments');
    await migrate(early);
    expect(await early.get("SELECT count(*) AS n FROM sqlite_master WHERE name IN ('recurring_payments', 'payment_savings', 'payment_contributions')")).toEqual({ n: 3 });
  });

  test('migration 44: an obligatory payment of this month on is a repeating one — the day after its last spending, counted from it', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 43));
    await db.run("INSERT INTO categories (id, name, emoji) VALUES (90, 'Квартира', '🏠'), (91, 'Спорт', '🏋️')");
    await db.run("INSERT INTO plan_months (ym) VALUES ('2026-09'), ('2026-10')");
    await db.run(`INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES
      ('2026-09', 90, 60000, 'fixed', 'USD'), ('2026-10', 90, 60000, 'fixed', 'USD'), ('2026-10', 91, 30000, 'fixed', 'GEL')`);
    // rent paid by a transfer on 1 October; no spending in "Спорт"
    await db.run(`INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'transfer', 60000, 'USD', 'LANDLORD', 90, 'user', ?, '', 'r1')`, [Math.floor(new Date('2026-10-01T10:00:00').getTime() / 1000)]);
    await migrate(db, MIGRATIONS.slice(0, 44));
    jest.useRealTimers();
    expect(await db.all('SELECT category_id, merchant_key, amount_minor, currency, period_months, due FROM recurring_payments ORDER BY category_id')).toEqual([
      { category_id: 90, merchant_key: null, amount_minor: 60000, currency: 'USD', period_months: 1, due: '2026-11-01' },
      { category_id: 91, merchant_key: null, amount_minor: 30000, currency: 'GEL', period_months: 1, due: null },
    ]);
    expect(await db.all('SELECT id, recurring FROM categories WHERE id IN (90, 91)')).toEqual([{ id: 90, recurring: 1 }, { id: 91, recurring: 1 }]);
    // with a day — counted ('subs'); without — by hand; September stays as it was
    expect(await db.all('SELECT ym, category_id, kind FROM plan_items ORDER BY ym, category_id')).toEqual([
      { ym: '2026-09', category_id: 90, kind: 'fixed' }, { ym: '2026-10', category_id: 90, kind: 'subs' }, { ym: '2026-10', category_id: 91, kind: 'fixed' },
    ]);
  });

  test('migration 45: 44 undone — the payments without a merchant go, their categories obligatory again; a merchant\'s payment stays', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 44));
    // as 44 left them: "Квартира" with a payment without a merchant (counted, saving), "Подписки" with Netflix's and one by hand
    await db.run("INSERT INTO categories (id, name, emoji, recurring) VALUES (90, 'Квартира', '🏠', 1), (92, 'Подписки', '📺', 1)");
    await db.run("INSERT INTO plan_months (ym) VALUES ('2026-09'), ('2026-10'), ('2026-11')");
    await db.run(`INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES
      ('2026-09', 90, 60000, 'subs', 'USD'), ('2026-10', 90, 60000, 'subs', 'USD'), ('2026-11', 90, 60000, 'subs', 'USD'), ('2026-10', 92, 4000, 'subs', 'GEL')`);
    await db.run(`INSERT INTO recurring_payments (id, category_id, merchant_key, name, amount_minor, currency, period_months, due, since_ym, created_at) VALUES
      (1, 90, NULL, 'Квартира', 60000, 'USD', 1, '2026-11-01', '2026-10', 0), (2, 92, 'NETFLIX', 'Netflix', 3000, 'GEL', 1, '2026-10-20', '2026-10', 0),
      (3, 92, NULL, 'Подписки', 1000, 'GEL', 1, NULL, '2026-10', 0)`);
    await db.run("INSERT INTO payment_savings (id, payment_id, since_ym) VALUES (7, 1, '2026-10')");
    await db.run("INSERT INTO payment_contributions (saving_id, ym, minor) VALUES (7, '2026-10', 100)");
    await migrate(db);
    jest.useRealTimers();
    expect(await db.all('SELECT id FROM recurring_payments')).toEqual([{ id: 2 }]);
    expect(await db.get('SELECT count(*) AS n FROM payment_savings')).toEqual({ n: 0 });
    expect(await db.get('SELECT count(*) AS n FROM payment_contributions')).toEqual({ n: 0 });
    expect(await db.all('SELECT id, recurring FROM categories WHERE id IN (90, 92) ORDER BY id')).toEqual([{ id: 90, recurring: 0 }, { id: 92, recurring: 1 }]);
    // this month on obligatory again, the amount as it was; September stays; "Подписки" still counted from Netflix
    expect(await db.all('SELECT ym, category_id, kind, limit_minor FROM plan_items ORDER BY ym, category_id')).toEqual([
      { ym: '2026-09', category_id: 90, kind: 'subs', limit_minor: 60000 }, { ym: '2026-10', category_id: 90, kind: 'fixed', limit_minor: 60000 },
      { ym: '2026-10', category_id: 92, kind: 'subs', limit_minor: 4000 }, { ym: '2026-11', category_id: 90, kind: 'fixed', limit_minor: 60000 },
    ]);
  });

  test('migration 46: the payments there are — in months; weeks and once allowed, nothing else', async () => {
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 45));
    await db.run("INSERT INTO categories (id, name, recurring) VALUES (92, 'Подписки', 1)");
    await db.run(`INSERT INTO recurring_payments (id, category_id, merchant_key, name, amount_minor, currency, period_months, due, since_ym, created_at)
      VALUES (1, 92, 'NETFLIX', 'Netflix', 3000, 'GEL', 12, '2026-10-20', '2026-10', 0)`);
    await migrate(db);
    expect(await db.get('SELECT period_months, period_unit FROM recurring_payments')).toEqual({ period_months: 12, period_unit: 'month' });
    await db.run("UPDATE recurring_payments SET period_unit = 'week', period_months = 1");
    await db.run("UPDATE recurring_payments SET period_unit = 'once'");
    await expect(db.run("UPDATE recurring_payments SET period_unit = 'day'")).rejects.toHaveProperty('message', expect.stringContaining('CHECK constraint failed'));
  });

  test('migration 47: repeating payments on with none left — off, this month on a one-off payment; "Подписки" stays on', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T12:00:00'), advanceTimers: true });
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 46));
    await db.run("INSERT INTO categories (id, name, recurring) VALUES (90, 'Аренда', 1), (91, 'Спорт', 1), (92, 'Подписки', 1)");
    // Аренда: only a deleted one; Спорт: a live one
    await db.run(`INSERT INTO recurring_payments (id, category_id, merchant_key, name, amount_minor, currency, period_months, due, since_ym, created_at, deleted_at)
      VALUES (1, 90, NULL, 'Аренда', 130000, 'GEL', 1, '2026-10-13', '2026-10', 0, 5), (2, 91, NULL, 'Спорт', 9000, 'GEL', 1, '2026-10-20', '2026-10', 0, NULL)`);
    await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES ('2026-09', 90, 130000, 'subs', 'GEL'), ('2026-10', 90, 130000, 'subs', 'GEL')");
    await migrate(db, MIGRATIONS.slice(0, 47));
    jest.useRealTimers();
    expect(await db.all('SELECT id, recurring FROM categories WHERE id IN (90, 91, 92) ORDER BY id')).toEqual([
      { id: 90, recurring: 0 }, { id: 91, recurring: 1 }, { id: 92, recurring: 1 }]);
    expect(await db.all('SELECT ym, kind, limit_minor FROM plan_items WHERE category_id = 90 ORDER BY ym')).toEqual([
      { ym: '2026-09', kind: 'subs', limit_minor: 130000 }, { ym: '2026-10', kind: 'fixed', limit_minor: 130000 }]);
  });

  test('migration 48: payments are made of operations only — those without a merchant go with their savings; a category left without any is off', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-20T12:00:00'), advanceTimers: true });
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 47));
    // Аренда: one by hand only; Спорт: one by hand and a merchant's; "Подписки": one by hand only
    await db.run("INSERT INTO categories (id, name, recurring) VALUES (90, 'Аренда', 1), (91, 'Спорт', 1), (92, 'Подписки', 1)");
    await db.run(`INSERT INTO recurring_payments (id, category_id, merchant_key, name, amount_minor, currency, period_months, due, since_ym, created_at) VALUES
      (1, 90, NULL, 'Аренда', 130000, 'GEL', 1, '2026-11-05', '2026-10', 0), (2, 91, NULL, 'Спорт', 9000, 'GEL', 1, NULL, '2026-10', 0),
      (3, 91, 'FITPASS', 'Fitpass', 5000, 'GEL', 1, '2026-10-25', '2026-10', 0), (4, 92, NULL, 'Подписки', 1000, 'GEL', 1, NULL, '2026-10', 0)`);
    await db.run("INSERT INTO payment_savings (id, payment_id, since_ym) VALUES (7, 1, '2026-10')");
    await db.run("INSERT INTO payment_contributions (saving_id, ym, minor) VALUES (7, '2026-10', 100)");
    await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES ('2026-09', 90, 130000, 'subs', 'GEL'), ('2026-10', 90, 130000, 'subs', 'GEL')");
    await migrate(db);
    jest.useRealTimers();
    expect(await db.all('SELECT id FROM recurring_payments')).toEqual([{ id: 3 }]);
    expect(await db.get('SELECT count(*) AS n FROM payment_savings')).toEqual({ n: 0 });
    expect(await db.get('SELECT count(*) AS n FROM payment_contributions')).toEqual({ n: 0 });
    expect(await db.all('SELECT id, recurring FROM categories WHERE id IN (90, 91, 92) ORDER BY id')).toEqual([
      { id: 90, recurring: 0 }, { id: 91, recurring: 1 }, { id: 92, recurring: 1 }]);
    // this month on a one-off payment, the amount as it was; September stays
    expect(await db.all('SELECT ym, kind, limit_minor FROM plan_items WHERE category_id = 90 ORDER BY ym')).toEqual([
      { ym: '2026-09', kind: 'subs', limit_minor: 130000 }, { ym: '2026-10', kind: 'fixed', limit_minor: 130000 }]);
  });

  test('migration 49: "Повторять каждый месяц" is a limit\'s only — one-off payments of this month on unpinned, the past ones as they were', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-20T12:00:00'), advanceTimers: true });
    const db = openDatabase(':memory:');
    await migrate(db, MIGRATIONS.slice(0, 48));
    await db.run("INSERT INTO categories (id, name) VALUES (90, 'Подарки'), (91, 'Еда')");
    await db.run("INSERT INTO plan_months (ym) VALUES ('2026-09'), ('2026-10')");
    await db.run(`INSERT INTO plan_items (ym, category_id, limit_minor, pinned, kind, currency) VALUES
      ('2026-09', 90, 5000, 1, 'fixed', 'GEL'), ('2026-10', 90, 5000, 1, 'fixed', 'GEL'), ('2026-10', 91, 60000, 1, 'limit', 'GEL')`);
    await migrate(db);
    jest.useRealTimers();
    expect(await db.all('SELECT ym, category_id, pinned FROM plan_items ORDER BY ym, category_id')).toEqual([
      { ym: '2026-09', category_id: 90, pinned: 1 }, { ym: '2026-10', category_id: 90, pinned: 0 }, { ym: '2026-10', category_id: 91, pinned: 1 }]);
  });
});
