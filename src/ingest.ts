import parseTbc from './parsers/tbc';
import { sha256Hex } from './hash';
import { getDb } from './db';
import { findCategoryForMerchant } from './categorize';
import { incrementCategoryUsage } from './db/categories';
import { emitTransactionsChanged } from './events';

export type IncomingSms = {
  sender: string;
  body: string;
  /** ms since epoch as reported by the SMS; omitted for fixture imports */
  timestamp?: number;
};

export type IngestResult =
  | { status: 'ignored' }                       // not a transaction SMS
  | { status: 'duplicate'; txId: number }
  | { status: 'inserted'; txId: number; categoryId: number | null };

// Dedup key. For fixtures (no timestamp) this equals sha256(body + sender), which
// matches hashes already stored by the old importer.
export function smsHash(sms: IncomingSms): string {
  return sha256Hex(sms.body + sms.sender + (sms.timestamp ?? ''));
}

/** Parses one SMS, stores it and applies merchant rules. Shared by the headless task and importer. */
export async function ingestSms(sms: IncomingSms): Promise<IngestResult> {
  const parsed = parseTbc(sms.body);
  if (!parsed) return { status: 'ignored' };

  const db = await getDb();
  const hash = smsHash(sms);

  const rule = parsed.merchant_key ? await findCategoryForMerchant(parsed.merchant_key) : null;
  const categoryId = rule?.category_id ?? null;

  // OR IGNORE + changes check instead of SELECT-then-INSERT: the same SMS may be
  // delivered twice concurrently (e.g. receiver retry), and sms_hash is UNIQUE.
  const { changes, lastInsertRowid } = await db.run(
    `INSERT OR IGNORE INTO transactions
      (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parsed.bank,
      parsed.kind,
      parsed.amount_minor,
      parsed.currency,
      parsed.raw_merchant || null,
      parsed.merchant_key || null,
      categoryId,
      categoryId ? 'rule' : null,
      Math.floor(new Date(parsed.occurred_at).getTime() / 1000),
      sms.body,
      hash,
    ]
  );
  if (changes === 0) {
    const existing = await db.get<{ id: number }>('SELECT id FROM transactions WHERE sms_hash = ?', [hash]);
    return { status: 'duplicate', txId: existing!.id };
  }
  if (categoryId) await incrementCategoryUsage(categoryId);
  emitTransactionsChanged();

  return { status: 'inserted', txId: lastInsertRowid, categoryId };
}

export default ingestSms;
