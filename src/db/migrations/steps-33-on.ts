// The schema's history, migrations 33 and on (shipped ones are never edited).
import type { MigrationStep } from './step';

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
];
