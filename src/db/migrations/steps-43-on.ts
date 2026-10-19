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
];
