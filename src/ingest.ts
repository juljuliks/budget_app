import parseTbc from './parsers/tbc';
import type { ParsedTx } from './types';
import { sha256Hex } from './hash';
import { getDb } from './db';
import { findCategoryForMerchant } from './categorize';
import { isRememberable } from './types';
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

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Unix seconds for the transaction. The SMS text wins when it has a time. Date-only SMS
 * (transfers, deposits) and SMS without a date use the SMS receive time when it's on the
 * same day / available, so they don't all pile up at 00:00 or at "now" during an import.
 */
export function resolveOccurredAt(parsed: Pick<ParsedTx, 'occurred_at' | 'has_time'>, smsTimestampMs?: number, nowMs = Date.now()): number {
  const received = smsTimestampMs ? new Date(smsTimestampMs) : null;
  if (parsed.occurred_at) {
    const fromText = new Date(parsed.occurred_at); // no zone -> local time
    if (!parsed.has_time && received && sameLocalDay(fromText, received)) {
      return Math.floor(received.getTime() / 1000);
    }
    return Math.floor(fromText.getTime() / 1000);
  }
  return Math.floor((received ? received.getTime() : nowMs) / 1000);
}

/** Parses one SMS, stores it and applies merchant rules. Shared by the headless task and importer. */
export async function ingestSms(sms: IncomingSms): Promise<IngestResult> {
  const parsed = parseTbc(sms.body);
  if (!parsed) return { status: 'ignored' };

  const db = await getDb();
  const hash = smsHash(sms);

  // Only purchases / payments: a transfer or deposit "merchant" is a person (or nothing), the same person can
  // send money for different things, so those always ask for a category.
  const rule = parsed.merchant_key && isRememberable(parsed.kind) ? await findCategoryForMerchant(parsed.merchant_key) : null;
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
      resolveOccurredAt(parsed, sms.timestamp),
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
