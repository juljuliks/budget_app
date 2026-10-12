// The schema's history, migrations 33 and on (shipped ones are never edited).
import type { MigrationStep } from './step';
import { placeNextDayDated } from '../balance';

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
];
