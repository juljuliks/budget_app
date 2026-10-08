import { getDb } from './index';
import type { Db } from './types';
import { getSetting, setSetting } from './settings';
import { parseTbc, parseTbcBalance } from '../parsers/tbc';

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

/**
 * An SMS with only a date (deposits, transfers) is put at the time it came; it may come after an SMS whose balance
 * already has it in ("Balance: 50.73" after −63.34 from 14.07: 100 came before). The bank's balances tell: between two
 * of them the operations must add up. When they don't, and the gap is what this operation (with others of the day
 * that have no time and sit after it) brings, those happened before that balance: they're put just before it — in
 * the balance (counted once) and in the list. Checked from the latest balance of the day back.
 */
export async function placeByBalances(txId: number, db?: Db): Promise<void> {
  db ??= await getDb();
  const tx = await db.get<{ kind: string; amount_minor: number; currency: string; occurred_at: number; raw_sms: string; bank: string }>(
    'SELECT kind, amount_minor, currency, occurred_at, raw_sms, bank FROM transactions WHERE id = ?', [txId]);
  if (!tx || tx.bank === 'manual' || !SIGN[tx.kind]) return;
  const parsed = parseTbc(tx.raw_sms);
  if (!parsed || parsed.has_time || !parsed.occurred_at) return;
  const day = new Date(parsed.occurred_at);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 1000;
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime() / 1000;

  // the bank's operations up to the end of that day (a week back for the balance before it), in their order
  const rows = await db.all<{ id: number; kind: string; amount_minor: number; occurred_at: number; raw_sms: string }>(
    `SELECT id, kind, amount_minor, occurred_at, raw_sms FROM transactions
      WHERE bank != 'manual' AND currency = ? AND occurred_at >= ? AND occurred_at < ?
      ORDER BY occurred_at, id`, [tx.currency, dayStart - 7 * 86400, dayEnd]);
  const signed = (r: { kind: string; amount_minor: number }) => (SIGN[r.kind] ?? 0) * r.amount_minor;
  const anchors = rows.flatMap((r, i) => {
    const b = parseTbcBalance(r.raw_sms);
    return b && b.has_time && b.currency === tx.currency ? [{ i, at: r.occurred_at, minor: b.minor }] : [];
  });
  // the ones of that day without a time put after a balance: what may belong before it
  const dateOnly = (r: { raw_sms: string }) => { const p = parseTbc(r.raw_sms); return !!p && !p.has_time; };

  for (let k = anchors.length - 1; k >= 1; k--) {
    const a = anchors[k];
    const prev = anchors[k - 1];
    if (a.at < dayStart || a.at >= tx.occurred_at) continue;
    // what the operations between the two balances bring, as they're placed now
    const between = rows.slice(prev.i + 1, a.i + 1).reduce((sum, r) => sum + signed(r), 0);
    const gap = a.minor - (prev.minor + between);
    if (gap === 0) continue;
    const candidates = rows.filter((r) => r.occurred_at > a.at && r.occurred_at < dayEnd && r.id !== txId && dateOnly(r)).slice(0, 10);
    const own = signed(tx);
    // this one, with some of the others: the subset that fills the gap exactly
    for (let mask = 0; mask < 1 << candidates.length; mask++) {
      const picked = candidates.filter((_, j) => mask & (1 << j));
      if (own + picked.reduce((sum, r) => sum + signed(r), 0) !== gap) continue;
      const ids = [txId, ...picked.map((r) => r.id)];
      await db.run(`UPDATE transactions SET occurred_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [a.at - 1, ...ids]);
      return;
    }
  }
}
