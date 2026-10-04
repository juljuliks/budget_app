import { getDb } from './index';
import { getSetting, setSetting } from './settings';
import { parseTbcBalance } from '../parsers/tbc';

// The card balance, kept in sync with the bank: every SMS that reports "Balance: …" (purchases, balance-only SMS)
// sets it exactly; operations after it (a deposit has no balance in its SMS) are added on top until the next one.

const KEY = 'card_balance';

/** The last balance the bank reported: after the transaction `txId` (or as of `at` for a balance-only SMS). */
export type BalanceAnchor = { minor: number; currency: string; at: number; txId: number | null };

export type CardBalance = {
  minor: number;
  currency: string;
  /** when the bank last reported it */
  asOf: number;
  /** bank operations after that report, added to it: the balance is an estimate until the next SMS with one */
  pending: number;
};

/** Operations that move the card's money; a refund is only "initiated" in its SMS and arrives later. */
const SIGN: Record<string, number> = { deposit: 1, purchase: -1, payment: -1, transfer: -1, withdrawal: -1 };

async function readAnchor(): Promise<BalanceAnchor | null> {
  const v = await getSetting(KEY);
  if (v) {
    try { return JSON.parse(v) as BalanceAnchor; } catch { /* rebuilt below */ }
  }
  // first use: the latest stored SMS with a balance
  const db = await getDb();
  const rows = await db.all<{ id: number; occurred_at: number; raw_sms: string }>(
    `SELECT id, occurred_at, raw_sms FROM transactions
      WHERE bank != 'manual' AND raw_sms LIKE '%alance%'
      ORDER BY occurred_at DESC, id DESC LIMIT 20`);
  for (const r of rows) {
    const b = parseTbcBalance(r.raw_sms);
    if (!b) continue;
    const anchor = { minor: b.minor, currency: b.currency, at: r.occurred_at, txId: r.id };
    await setSetting(KEY, JSON.stringify(anchor));
    return anchor;
  }
  return null;
}

/** Remembers a balance the bank reported, unless a later one is already known (SMS can arrive out of order). */
export async function recordBalance(anchor: BalanceAnchor): Promise<void> {
  const current = await readAnchor();
  if (current && current.at > anchor.at) return;
  await setSetting(KEY, JSON.stringify(anchor));
}

/** The card balance now: the last reported one plus the bank operations after it; null until an SMS reports one. */
export async function cardBalance(): Promise<CardBalance | null> {
  const anchor = await readAnchor();
  if (!anchor) return null;
  const db = await getDb();
  const after = await db.all<{ kind: string; amount_minor: number }>(
    `SELECT kind, amount_minor FROM transactions
      WHERE bank != 'manual' AND currency = ?
        AND (occurred_at > ? OR (occurred_at = ? AND ? IS NOT NULL AND id > ?))`,
    [anchor.currency, anchor.at, anchor.at, anchor.txId, anchor.txId ?? 0]);
  let minor = anchor.minor;
  let pending = 0;
  for (const t of after) {
    const sign = SIGN[t.kind];
    if (!sign) continue;
    minor += sign * t.amount_minor;
    pending++;
  }
  return { minor, currency: anchor.currency, asOf: anchor.at, pending };
}
