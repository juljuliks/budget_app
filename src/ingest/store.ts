// Storing an operation read from a bank message (by the built-in parser or a user's template): its SMS / push twin
// and the same message twice are stored once; its merchant's category, the card balance after it.
import type { ParsedTx } from '../domain/types';
import { placeByBalances, recordBalance } from '../db/balance';
import { refundCategory } from '../db/refunds';
import { sha256Hex } from './hash';
import type { Db } from '../db';
import { findCategoryForMerchant } from '../categorize/rules';
import { isRememberable } from '../domain/types';
import { incrementCategoryUsage, topUpCategoryId } from '../db/categories';

export type IncomingSms = {
  sender: string;
  body: string;
  /** ms since epoch as reported by the SMS; omitted for fixture imports */
  timestamp?: number;
  /** 'push' = a bank app notification (BankPushListener); default 'sms' */
  source?: 'sms' | 'push';
  /** the hash it was kept with ("Не распознано"): read later by a template, it is still the same message */
  hash?: string;
};

/** The same operation reported by SMS and by push within this window is stored once. */
export const CROSS_SOURCE_WINDOW_S = 15 * 60;

export type IngestResult =
  // not an operation: nothing kept, kept in "Не распознано" (`unparsed`) or dropped by a "hide such" template (`hidden`)
  | { status: 'ignored'; kept?: 'unparsed' | 'hidden' }
  | { status: 'duplicate'; txId: number }
  | { status: 'inserted'; txId: number; categoryId: number | null; kind: string };

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

/** Stores a parsed operation (unless its SMS / push twin or the same SMS is there), inside `db`'s transaction. */
export async function store(sms: IncomingSms, parsed: ParsedTx, balance: { minor: number; currency: string } | null, db: Db): Promise<IngestResult> {
  const hash = sms.hash ?? smsHash(sms);

  // Only purchases / payments: a transfer or deposit "merchant" is a person (or nothing), the same person can
  // send money for different things, so those always ask for a category.
  const source = sms.source ?? 'sms';
  const occurredAt = resolveOccurredAt(parsed, sms.timestamp);
  const rule = parsed.merchant_key && isRememberable(parsed.kind) ? await findCategoryForMerchant(parsed.merchant_key, db) : null;
  // a refund is subtracted from its merchant's category right away (see refundCategory); settling it on the purchase is optional
  // a deposit: "Пополнение счёта" (money that came to the card); moved by hand when it was a person paying back
  const categoryId = parsed.kind === 'refund' ? await refundCategory(parsed.merchant_key, occurredAt, db)
    : parsed.kind === 'deposit' ? await topUpCategoryId(db)
    : rule?.category_id ?? null;
  // the bank may report one operation both by SMS and by push: keep the first
  const twin = await db.get<{ id: number; occurred_at: number }>(
    `SELECT id, occurred_at FROM transactions
      WHERE merchant_key IS ? AND occurred_at BETWEEN ? AND ?
        AND source != ? AND kind = ? AND amount_minor = ? AND currency = ?
      LIMIT 1`,
    [parsed.merchant_key || null, occurredAt - CROSS_SOURCE_WINDOW_S, occurredAt + CROSS_SOURCE_WINDOW_S,
      source, parsed.kind, parsed.amount_minor, parsed.currency]);
  if (twin) {
    // the push came first without a balance, the SMS has it
    if (balance) await recordBalance({ minor: balance.minor, currency: balance.currency, at: twin.occurred_at, txId: twin.id }, db);
    return { status: 'duplicate', txId: twin.id };
  }

  // OR IGNORE + changes check instead of SELECT-then-INSERT: the same SMS may be
  // delivered twice concurrently (e.g. receiver retry), and sms_hash is UNIQUE.
  const { changes, lastInsertRowid } = await db.run(
    `INSERT OR IGNORE INTO transactions
      (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parsed.bank,
      parsed.kind,
      parsed.amount_minor,
      parsed.currency,
      parsed.raw_merchant || null,
      parsed.merchant_key || null,
      categoryId,
      categoryId && parsed.kind !== 'deposit' ? 'rule' : null,
      occurredAt,
      sms.body,
      hash,
      source,
    ]
  );
  if (changes === 0) {
    const existing = await db.get<{ id: number }>('SELECT id FROM transactions WHERE sms_hash = ?', [hash]);
    return { status: 'duplicate', txId: existing!.id };
  }
  // the balance after this operation, as the bank reports it
  if (balance) await recordBalance({ minor: balance.minor, currency: balance.currency, at: occurredAt, txId: lastInsertRowid }, db);
  // only a date: maybe a balance the bank reported already had it in (it came before that SMS)
  if (!parsed.has_time) await placeByBalances(lastInsertRowid, db);
  if (categoryId && parsed.kind !== 'refund' && parsed.kind !== 'deposit') await incrementCategoryUsage(categoryId, 1, db);

  return { status: 'inserted', txId: lastInsertRowid, categoryId, kind: parsed.kind };
}

