// The schema's history, migrations 43 and on (shipped ones are never edited).
import type { MigrationStep } from './step';
import type { Db } from '../types';

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
];
