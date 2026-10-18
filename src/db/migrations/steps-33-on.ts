// The schema's history, migrations 33 and on (shipped ones are never edited).
import type { MigrationStep } from './step';
import { placeNextDayDated } from '../balance';
import { moveParts } from '../parts';

/** Migrations 33 and on: a new one is appended here (when this file nears 250 lines, the next file starts). */
export const STEPS_33_ON: MigrationStep[][] = [
  // 33: an operation split between categories ("Разделить по категориям"). Its other categories' parts are kept here; its
  // own category (transactions.category_id) gets the rest. Its category changed: a part in that category merges back
  // into it, none (uncategorized) — no parts. spend_parts: every operation as the parts its spending is counted in
  // (one row per part, the amount the part's), with all the columns of transactions — re-create it when they change.
  [
    `CREATE TABLE IF NOT EXISTS transaction_parts (
      tx_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount_minor INTEGER NOT NULL,
      PRIMARY KEY (tx_id, category_id)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_parts_category ON transaction_parts(category_id)',
    `CREATE TRIGGER IF NOT EXISTS parts_gone_with_tx AFTER DELETE ON transactions BEGIN
      DELETE FROM transaction_parts WHERE tx_id = old.id;
    END`,
    `CREATE TRIGGER IF NOT EXISTS parts_follow_category AFTER UPDATE OF category_id ON transactions BEGIN
      DELETE FROM transaction_parts WHERE tx_id = new.id AND (new.category_id IS NULL OR category_id = new.category_id);
    END`,
    `CREATE VIEW IF NOT EXISTS spend_parts AS
      SELECT t.id, t.bank, t.kind,
        t.amount_minor - coalesce((SELECT sum(p.amount_minor) FROM transaction_parts p WHERE p.tx_id = t.id), 0) AS amount_minor,
        t.currency, t.raw_merchant, t.merchant_key, t.category_id, t.category_source, t.occurred_at, t.raw_sms, t.sms_hash,
        t.source, t.seen_at, t.refund_settled_at, t.refund_target_id, t.note, t.merchant_detached, t.search_text
      FROM transactions t
      UNION ALL
      SELECT t.id, t.bank, t.kind, p.amount_minor, t.currency, t.raw_merchant, t.merchant_key, p.category_id, t.category_source,
        t.occurred_at, t.raw_sms, t.sms_hash, t.source, t.seen_at, t.refund_settled_at, t.refund_target_id, t.note,
        t.merchant_detached, t.search_text
      FROM transaction_parts p JOIN transactions t ON t.id = p.tx_id`,
  ],
  // 34: a transfer TBC dated the next day was put at 00:00 of it: "after" the balances that already have it in (taken
  // twice from the card's balance). Moved to the day it came and placed by the balances (placeNextDayDated)
  [(db) => placeNextDayDated(db)],
  // 35: other banks. A template reads its own bank's messages (all made so far are TBC's). "Между своими картами"
  // (categories.system = 'own'): money from one's card to one's other card — not spending, not income; put by hand,
  // in the transfers' section. A category already so named becomes it
  [
    "ALTER TABLE message_templates ADD COLUMN bank TEXT NOT NULL DEFAULT 'tbc'",
    async (db) => {
      const own = await db.get<{ id: number }>(
        "SELECT id FROM categories WHERE deleted_at IS NULL AND system IS NULL AND lower(name) = 'между своими картами' LIMIT 1");
      if (own) await db.run("UPDATE categories SET system = 'own' WHERE id = ?", [own.id]);
      else {
        await db.run(
          `INSERT INTO categories (name, emoji, system, sort_order, type_id)
            VALUES ('Между своими картами', '🔁', 'own', 102, (SELECT id FROM category_types WHERE is_transfer = 1 ORDER BY id LIMIT 1))`);
      }
    },
  ],
  // 36: "Не распознано" keeps a message 30 days from when it was kept, not from its date: an import of months (another
  // bank's SMS before its template) all waits for the template
  [
    'ALTER TABLE unparsed_messages ADD COLUMN kept_at INTEGER',
    'UPDATE unparsed_messages SET kept_at = received_at',
  ],
  // 37: "Копилка": a category saved up for (a holiday, the insurance) — how much by when. Each month of a plan puts a
  // contribution in it (its plan item, kind 'fund': what is left to save over the months left), its spending is taken
  // from what is saved. Deleted: closed_ym, what was saved goes to that month's savings (released_minor). plan_items
  // is rebuilt for the new kind (its CHECK)
  [
    `CREATE TABLE IF NOT EXISTS funds (
      category_id INTEGER PRIMARY KEY,
      target_minor INTEGER NOT NULL CHECK (target_minor > 0),
      currency TEXT NOT NULL,
      due TEXT NOT NULL,
      start_minor INTEGER NOT NULL DEFAULT 0 CHECK (start_minor >= 0),
      since_ym TEXT NOT NULL,
      closed_ym TEXT,
      released_minor INTEGER
    )`,
    `CREATE TABLE plan_items_new (
      ym TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (limit_minor >= 0),
      pinned INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'limit' CHECK (kind IN ('limit', 'fixed', 'fund')),
      currency TEXT NOT NULL DEFAULT 'GEL',
      norm_period TEXT NOT NULL DEFAULT 'day' CHECK (norm_period IN ('day', 'week', '2weeks', 'month')),
      PRIMARY KEY (ym, category_id),
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    )`,
    `INSERT INTO plan_items_new (ym, category_id, limit_minor, pinned, kind, currency, norm_period)
      SELECT ym, category_id, limit_minor, pinned, kind, currency, norm_period FROM plan_items`,
    'DROP TABLE plan_items',
    'ALTER TABLE plan_items_new RENAME TO plan_items',
  ],
  // 38: "Итоги месяца": a month over is closed with answers — did the funds' contributions go in (fund_confirms: what
  // went, 0 = nothing), what covers an overspend, where the leftover goes, was the saving put aside. Closed: closed_at,
  // and what goes to the next month (carry_*: an overspend owed, the leftover moved, in the budget's currency). The
  // months before this one are closed as they were: the leftover as the budget's switch had it, the contributions as planned
  [
    `CREATE TABLE IF NOT EXISTS month_closes (
      ym TEXT PRIMARY KEY,
      over_cover TEXT CHECK (over_cover IN ('savings', 'next', 'covered')),
      over_rest_cover TEXT CHECK (over_rest_cover IN ('next', 'covered')),
      rest_choice TEXT CHECK (rest_choice IN ('savings', 'next', 'keep')),
      saved TEXT CHECK (saved IN ('yes', 'other', 'no')),
      saved_minor INTEGER,
      confirmed_minor INTEGER,
      closed_at INTEGER,
      carry_debt_minor INTEGER NOT NULL DEFAULT 0,
      carry_plus_minor INTEGER NOT NULL DEFAULT 0,
      carry_currency TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS fund_confirms (
      category_id INTEGER NOT NULL,
      ym TEXT NOT NULL,
      saved_minor INTEGER NOT NULL CHECK (saved_minor >= 0),
      PRIMARY KEY (category_id, ym)
    )`,
    async (db) => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await db.run(
        `INSERT OR IGNORE INTO month_closes (ym, rest_choice, closed_at)
          SELECT ym, CASE WHEN to_savings = 1 THEN 'savings' ELSE 'keep' END, ? FROM plan_months WHERE ym < ?`,
        [Math.floor(now.getTime() / 1000), ym]);
      await db.run(
        "INSERT OR IGNORE INTO fund_confirms (category_id, ym, saved_minor) SELECT category_id, ym, limit_minor FROM plan_items WHERE kind = 'fund' AND ym < ?",
        [ym]);
    },
  ],
  // 39: "Подписки": a system category (system = 'subs'; the one so named, or a new one) and its subscriptions — a merchant
  // (or a name without one) charged every period_months from the day set (due; null — "Без даты списания"). Its plan
  // item is of a kind of its own ('subs'): the month's charges, counted (plan_items rebuilt for it). save / start_minor —
  // saving up for one charged less often than monthly (not used yet). A deleted one keeps its row (deleted_at)
  [
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY,
      merchant_key TEXT,
      name TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      currency TEXT NOT NULL,
      period_months INTEGER NOT NULL DEFAULT 1 CHECK (period_months BETWEEN 1 AND 36),
      due TEXT,
      since_ym TEXT NOT NULL,
      save INTEGER NOT NULL DEFAULT 0,
      start_minor INTEGER NOT NULL DEFAULT 0 CHECK (start_minor >= 0),
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_merchant ON subscriptions(merchant_key) WHERE merchant_key IS NOT NULL AND deleted_at IS NULL',
    `CREATE TABLE plan_items_new (
      ym TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (limit_minor >= 0),
      pinned INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'limit' CHECK (kind IN ('limit', 'fixed', 'fund', 'subs')),
      currency TEXT NOT NULL DEFAULT 'GEL',
      norm_period TEXT NOT NULL DEFAULT 'day' CHECK (norm_period IN ('day', 'week', '2weeks', 'month')),
      PRIMARY KEY (ym, category_id),
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    )`,
    `INSERT INTO plan_items_new (ym, category_id, limit_minor, pinned, kind, currency, norm_period)
      SELECT ym, category_id, limit_minor, pinned, kind, currency, norm_period FROM plan_items`,
    'DROP TABLE plan_items',
    'ALTER TABLE plan_items_new RENAME TO plan_items',
    async (db) => {
      // by name in JS: SQLite's lower() leaves Cyrillic as it is
      const subs = (await db.all<{ id: number; name: string }>('SELECT id, name FROM categories WHERE deleted_at IS NULL AND system IS NULL ORDER BY id'))
        .find((c) => c.name.trim().toLowerCase() === 'подписки');
      if (subs) await db.run("UPDATE categories SET system = 'subs' WHERE id = ?", [subs.id]);
      else await db.run("INSERT INTO categories (name, emoji, system, sort_order) VALUES ('Подписки', '📺', 'subs', 7)");
    },
  ],
  // 40: no "Сбережения" category (system = 'savings'): money moved to one's own savings account is a transfer between
  // one's own accounts. Its operations (and their parts), rules and merchants go to "Между своими картами" (not spending
  // either), the category itself is gone; with no such category it becomes it
  [
    async (db) => {
      const savings = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'savings'"))?.id;
      if (savings === undefined) return;
      const own = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'own'"))?.id;
      if (own === undefined) {
        await db.run(
          `UPDATE categories SET system = 'own', name = 'Между своими картами', emoji = '🔁', deleted_at = NULL,
            type_id = (SELECT id FROM category_types WHERE is_transfer = 1 ORDER BY id LIMIT 1) WHERE id = ?`, [savings]);
        return;
      }
      await moveParts(db, [savings], own);
      await db.run('UPDATE transactions SET category_id = ? WHERE category_id = ?', [own, savings]);
      await db.run('UPDATE OR IGNORE merchant_rules SET category_id = ? WHERE category_id = ?', [own, savings]);
      await db.run('DELETE FROM merchant_rules WHERE category_id = ?', [savings]);
      await db.run('UPDATE OR IGNORE merchant_categories SET category_id = ? WHERE category_id = ?', [own, savings]);
      await db.run('DELETE FROM merchant_categories WHERE category_id = ?', [savings]);
      const used = (await db.get<{ n: number }>('SELECT coalesce(sum(usage_count), 0) AS n FROM category_usage WHERE category_id = ?', [savings]))?.n ?? 0;
      await db.run('DELETE FROM category_usage WHERE category_id = ?', [savings]);
      if (used) {
        await db.run(
          `INSERT INTO category_usage (category_id, usage_count) VALUES (?, ?)
            ON CONFLICT (category_id) DO UPDATE SET usage_count = usage_count + excluded.usage_count`, [own, used]);
      }
      await db.run('DELETE FROM plan_items WHERE category_id = ?', [savings]);
      await db.run('DELETE FROM categories WHERE id = ?', [savings]);
    },
  ],
  // 41: saving up for a subscription ("Откладывать каждый месяц?"): a saving is like a fund of the subscription's —
  // from since_ym, "Уже отложено" (start_minor), closed (turned off, the subscription deleted) in closed_ym with what it
  // had (released_minor: that month's savings); charges before it was made (created_at) aren't its. A past month's contribution is what its plan had (sub_contributions,
  // written while the month is the current or a coming one)
  [
    `CREATE TABLE IF NOT EXISTS sub_savings (
      id INTEGER PRIMARY KEY,
      sub_id INTEGER NOT NULL,
      since_ym TEXT NOT NULL,
      start_minor INTEGER NOT NULL DEFAULT 0 CHECK (start_minor >= 0),
      closed_ym TEXT,
      released_minor INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_savings_open ON sub_savings(sub_id) WHERE closed_ym IS NULL',
    `CREATE TABLE IF NOT EXISTS sub_contributions (
      saving_id INTEGER NOT NULL,
      ym TEXT NOT NULL,
      minor INTEGER NOT NULL,
      PRIMARY KEY (saving_id, ym)
    )`,
  ],
  // 42: repeating payments in any category ("Повторяющиеся платежи", categories.recurring): its plan item counted from
  // them (kind 'subs'), each subscription (a repeating payment) of its category (subscriptions.category_id). "Подписки"
  // is no longer a system category: one with the switch on, its subscriptions its own
  [
    'ALTER TABLE categories ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN category_id INTEGER',
    async (db) => {
      const subs = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'subs'"))?.id;
      if (subs === undefined) return;
      await db.run('UPDATE categories SET recurring = 1, system = NULL WHERE id = ?', [subs]);
      await db.run('UPDATE subscriptions SET category_id = ?', [subs]);
    },
  ],
];
