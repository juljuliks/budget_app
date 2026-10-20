// The schema's history, migrations 43 and on (shipped ones are never edited).
import type { MigrationStep } from './step';
import type { Db } from '../types';
import { offeredDue } from '../recurring/schedule';

const exists = async (db: Db, table: string) => !!(await db.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", [table]));
const columns = async (db: Db, table: string) => (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);

/** Migrations 43 and on: a new one is appended here (when this file nears 250 lines, the next file starts). */
export const STEPS_43_ON: MigrationStep[][] = [
  // 43: the code's word for a subscription is a repeating payment: subscriptions → recurring_payments, sub_savings →
  // payment_savings (sub_id → payment_id), sub_contributions → payment_contributions. Each only if not so yet (a build
  // between them renamed the first already); a saving made before created_at was there — 0
  [
    async (db) => {
      if (await exists(db, 'subscriptions') && !(await exists(db, 'recurring_payments'))) {
        await db.run('ALTER TABLE subscriptions RENAME TO recurring_payments');
      }
      if (await exists(db, 'sub_savings')) {
        const created = (await columns(db, 'sub_savings')).includes('created_at') ? 'created_at' : '0';
        await db.run(`CREATE TABLE payment_savings (
          id INTEGER PRIMARY KEY,
          payment_id INTEGER NOT NULL,
          since_ym TEXT NOT NULL,
          start_minor INTEGER NOT NULL DEFAULT 0 CHECK (start_minor >= 0),
          closed_ym TEXT,
          released_minor INTEGER,
          created_at INTEGER NOT NULL DEFAULT 0
        )`);
        await db.run(`INSERT INTO payment_savings (id, payment_id, since_ym, start_minor, closed_ym, released_minor, created_at)
          SELECT id, sub_id, since_ym, start_minor, closed_ym, released_minor, ${created} FROM sub_savings`);
        await db.run('DROP TABLE sub_savings');
        await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_savings_open ON payment_savings(payment_id) WHERE closed_ym IS NULL');
      }
      if (await exists(db, 'sub_contributions')) await db.run('ALTER TABLE sub_contributions RENAME TO payment_contributions');
    },
  ],
  // 44: "Обязательный платёж" is a repeating payment now: a category obligatory in the current month or a coming one
  // (and without repeating payments yet) gets a payment without a merchant — every month, the item's amount, the next day
  // after its last spending (none — no day: the amount stays by hand); its repeating payments on, the items with a day
  // counted from it ('subs'). The past months stay as they were
  [
    async (db) => {
      const now = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const ym = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
      const today = `${ym}-${p2(now.getDate())}`;
      const items = await db.all<{ category_id: number; name: string; limit_minor: number; currency: string }>(
        `SELECT p.category_id, c.name, p.limit_minor, p.currency FROM plan_items p JOIN categories c ON c.id = p.category_id
          WHERE p.kind = 'fixed' AND p.ym >= ? AND c.recurring = 0 AND c.deleted_at IS NULL ORDER BY p.ym`, [ym]);
      const done = new Set<number>();
      for (const it of items) {
        if (done.has(it.category_id)) continue;
        done.add(it.category_id);
        const last = (await db.get<{ at: number | null }>(
          "SELECT max(occurred_at) AS at FROM spend_parts WHERE category_id = ? AND kind IN ('purchase', 'payment', 'transfer', 'withdrawal')", [it.category_id]))?.at;
        const d = last ? new Date(last * 1000) : null;
        const due = d ? offeredDue(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, 1, today) : null;
        await db.run(
          `INSERT INTO recurring_payments (category_id, merchant_key, name, amount_minor, currency, period_months, due, since_ym, created_at)
            VALUES (?, NULL, ?, ?, ?, 1, ?, ?, ?)`, [it.category_id, it.name, it.limit_minor, it.currency, due, ym, Math.floor(now.getTime() / 1000)]);
        await db.run('UPDATE categories SET recurring = 1 WHERE id = ?', [it.category_id]);
        if (due) await db.run("UPDATE plan_items SET kind = 'subs' WHERE category_id = ? AND ym >= ? AND kind = 'fixed'", [it.category_id, ym]);
      }
    },
  ],
  // 45: 44 undone — "Обязательный платёж" is back: the payments without a merchant (made by 44 or from the plan's sheet)
  // go with their savings; a category left without payments has its repeating payments off, its items of this month on
  // obligatory again ('fixed', the amount as it is). The past months stay as they were
  [
    async (db) => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const cats = (await db.all<{ c: number }>('SELECT DISTINCT category_id AS c FROM recurring_payments WHERE merchant_key IS NULL AND category_id IS NOT NULL')).map((r) => r.c);
      const savings = 'SELECT id FROM payment_savings WHERE payment_id IN (SELECT id FROM recurring_payments WHERE merchant_key IS NULL)';
      await db.run(`DELETE FROM payment_contributions WHERE saving_id IN (${savings})`);
      await db.run(`DELETE FROM payment_savings WHERE id IN (${savings})`);
      await db.run('DELETE FROM recurring_payments WHERE merchant_key IS NULL');
      for (const c of cats) {
        if (await db.get('SELECT 1 FROM recurring_payments WHERE category_id = ?', [c])) continue;
        await db.run('UPDATE categories SET recurring = 0 WHERE id = ?', [c]);
        await db.run("UPDATE plan_items SET kind = 'fixed' WHERE category_id = ? AND ym >= ? AND kind = 'subs'", [c, ym]);
      }
    },
  ],
  // 46: a repeating payment's period unit: months (as before), weeks ("Каждую неделю": period_months is the weeks then) or
  // once ("Один раз": its day only)
  [
    "ALTER TABLE recurring_payments ADD COLUMN period_unit TEXT NOT NULL DEFAULT 'month' CHECK (period_unit IN ('month', 'week', 'once'))",
  ],
  // 47: a category with its repeating payments on but none left (deleted, or taken by 45) — off, as deleting the last one
  // does now: its items of this month on a one-off payment again ('fixed', the amount as it is); "Подписки" stays on
  [
    async (db) => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const cats = await db.all<{ id: number }>(
        `SELECT id FROM categories c WHERE recurring = 1 AND name <> 'Подписки'
          AND NOT EXISTS (SELECT 1 FROM recurring_payments p WHERE p.category_id = c.id AND p.deleted_at IS NULL)`);
      for (const { id } of cats) {
        await db.run('UPDATE categories SET recurring = 0 WHERE id = ?', [id]);
        await db.run("UPDATE plan_items SET kind = 'fixed' WHERE category_id = ? AND ym >= ? AND kind = 'subs'", [id, ym]);
      }
    },
  ],
  // 48: a repeating payment is made from an operation only (its merchant): those without a merchant (from the plan's
  // sheet, "Без мерчанта") go with their savings, as in 45; a category left without payments — off as in 47
  [
    async (db) => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const cats = (await db.all<{ c: number }>('SELECT DISTINCT category_id AS c FROM recurring_payments WHERE merchant_key IS NULL AND category_id IS NOT NULL')).map((r) => r.c);
      const savings = 'SELECT id FROM payment_savings WHERE payment_id IN (SELECT id FROM recurring_payments WHERE merchant_key IS NULL)';
      await db.run(`DELETE FROM payment_contributions WHERE saving_id IN (${savings})`);
      await db.run(`DELETE FROM payment_savings WHERE id IN (${savings})`);
      await db.run('DELETE FROM recurring_payments WHERE merchant_key IS NULL');
      for (const c of cats) {
        if (await db.get("SELECT 1 FROM categories WHERE id = ? AND name = 'Подписки'", [c])) continue;
        if (await db.get('SELECT 1 FROM recurring_payments WHERE category_id = ? AND deleted_at IS NULL', [c])) continue;
        await db.run('UPDATE categories SET recurring = 0 WHERE id = ?', [c]);
        await db.run("UPDATE plan_items SET kind = 'fixed' WHERE category_id = ? AND ym >= ? AND kind = 'subs'", [c, ym]);
      }
    },
  ],
  // 49: "Повторять каждый месяц" is a limit's only. A one-off payment repeated each month (this month on) is a regular
  // payment now: the category's own one ("Траты категории"), every month, without a day — the same amount stands in
  // each month's plan, carried over as its category has regular payments; the pin goes
  [
    async (db) => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const items = await db.all<{ category_id: number; limit_minor: number; currency: string; name: string }>(
        `SELECT p.category_id, p.limit_minor, p.currency, c.name FROM plan_items p JOIN categories c ON c.id = p.category_id
          WHERE p.kind = 'fixed' AND p.pinned = 1 AND p.ym >= ? AND p.limit_minor > 0 AND c.deleted_at IS NULL
          ORDER BY p.ym`, [ym]);
      const done = new Set<number>();
      for (const it of items) {
        if (done.has(it.category_id)) continue;
        done.add(it.category_id);
        // it has payments already: they count it
        if (await db.get('SELECT 1 FROM recurring_payments WHERE category_id = ? AND deleted_at IS NULL', [it.category_id])) continue;
        await db.run(
          `INSERT INTO recurring_payments (category_id, merchant_key, name, amount_minor, currency, period_months, period_unit, due, since_ym, created_at)
            VALUES (?, NULL, ?, ?, ?, 1, 'month', NULL, ?, ?)`, [it.category_id, it.name, it.limit_minor, it.currency, ym, Math.floor(now.getTime() / 1000)]);
        await db.run('UPDATE categories SET recurring = 1 WHERE id = ?', [it.category_id]);
      }
      await db.run("UPDATE plan_items SET pinned = 0 WHERE kind = 'fixed' AND ym >= ?", [ym]);
    },
  ],
  // 50: "Дата окончания" of a repeating payment and of a plan item repeated each month (`until`, its last day, 'YYYY-MM-DD');
  // a regular payment within the month (a one-off payment's kind, 'fixed', with `every`): every day or on the weekdays
  // (`weekdays`, Monday — bit 0), `unit_minor` each time, the item the times in the month by it
  [
    'ALTER TABLE recurring_payments ADD COLUMN until TEXT',
    'ALTER TABLE plan_items ADD COLUMN until TEXT',
    "ALTER TABLE plan_items ADD COLUMN every TEXT CHECK (every IN ('day', 'week'))",
    'ALTER TABLE plan_items ADD COLUMN weekdays INTEGER',
    'ALTER TABLE plan_items ADD COLUMN unit_minor INTEGER CHECK (unit_minor >= 0)',
  ],
  // 51: "Разные мерчанты" of a category: on — a payment of each merchant (from an operation), as "Подписки"; off — the
  // category's spending is its payment. On for "Подписки" and the categories with merchants' payments
  [
    'ALTER TABLE categories ADD COLUMN by_merchant INTEGER NOT NULL DEFAULT 0',
    `UPDATE categories SET by_merchant = 1 WHERE name = 'Подписки'
      OR id IN (SELECT category_id FROM recurring_payments WHERE merchant_key IS NOT NULL AND deleted_at IS NULL AND category_id IS NOT NULL)`,
  ],
  // 52: "Это оплата?" — an operation (its part in a category) of another amount than the category's payment ("Траты
  // категории"): answered yes (1) or no (0); not answered — not counted as paying it
  [
    `CREATE TABLE payment_answers (
      tx_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL,
      is_payment INTEGER NOT NULL CHECK (is_payment IN (0, 1)),
      PRIMARY KEY (tx_id, category_id)
    )`,
  ],
  // 53: a regular category's item was stored in the budget's currency (750 ₾ as 288.61 $, shown as 749.99 ₾ — a
  // kopeck over the plan); 48 left such ones as one-off payments. The current and coming months' payments in the
  // budget's currency that come to whole lari (±2 tetri) by the plan's rate are in lari again, whole
  [
    async (db) => {
      const now = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const ym = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
      const today = `${ym}-${p2(now.getDate())}`;
      const rows = await db.all<{ ym: string; category_id: number; limit_minor: number; currency: string }>(
        `SELECT p.ym, p.category_id, p.limit_minor, p.currency FROM plan_items p JOIN plan_months m ON m.ym = p.ym
          WHERE p.ym >= ? AND p.kind IN ('fixed', 'subs') AND p.currency = m.budget_currency AND p.currency <> 'GEL' AND p.limit_minor > 0
            -- converted ones have cents; one typed in dollars is whole and stays
            AND p.limit_minor % 100 <> 0`, [ym]);
      for (const r of rows) {
        // the plan's rate: its month's last day, not after today (as planRateDate)
        const [y, m] = r.ym.split('-').map(Number);
        const last = `${r.ym}-${p2(new Date(y, m, 0).getDate())}`;
        const day = last < today ? last : today;
        const rate = (await db.get<{ g: number }>(
          `SELECT coalesce((SELECT gel_per_unit FROM fx_rates WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1),
            (SELECT gel_per_unit FROM fx_rates WHERE currency = ? ORDER BY date LIMIT 1)) AS g`, [r.currency, day, r.currency]))?.g;
        if (!rate) continue;
        const lari = r.limit_minor * rate;
        const whole = Math.round(lari / 100) * 100;
        if (whole > 0 && Math.abs(lari - whole) <= 2) {
          await db.run("UPDATE plan_items SET currency = 'GEL', limit_minor = ? WHERE ym = ? AND category_id = ?", [whole, r.ym, r.category_id]);
        }
      }
    },
  ],
  // 54: a category's own regular payment isn't matched with operations any more: "Это оплата?" answers gone
  ['DROP TABLE IF EXISTS payment_answers'],
  // 55: a regular payment within the month is always carried over, "Дата окончания" its end: one saved not repeated
  // ends with its month
  [
    `UPDATE plan_items SET pinned = 1, until = CASE WHEN until IS NOT NULL AND until < date(ym || '-01', '+1 month', '-1 day')
        THEN until ELSE date(ym || '-01', '+1 month', '-1 day') END
      WHERE kind = 'fixed' AND every IS NOT NULL AND pinned = 0`,
  ],
];
