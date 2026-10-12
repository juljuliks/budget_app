import { getDb } from './index';
import type { Db } from './types';
import { getSetting, setSetting } from './settings';
import { parseTbc, parseTbcBalance } from '../parsers/tbc';
import { placeholders } from './sql';

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

async function readAnchor(db?: Db): Promise<BalanceAnchor | null> {
  db ??= await getDb();
  const v = await getSetting(KEY, db);
  if (v) {
    try { return JSON.parse(v) as BalanceAnchor; } catch { /* rebuilt below */ }
  }
  // first use: the latest stored SMS with a balance
  const rows = await db.all<{ id: number; occurred_at: number; raw_sms: string }>(
    `SELECT id, occurred_at, raw_sms FROM transactions
      WHERE bank != 'manual' AND raw_sms LIKE '%alance%'
      ORDER BY occurred_at DESC, id DESC LIMIT 20`);
  for (const r of rows) {
    const b = parseTbcBalance(r.raw_sms);
    if (!b) continue;
    const anchor = { minor: b.minor, currency: b.currency, at: r.occurred_at, txId: r.id };
    await setSetting(KEY, JSON.stringify(anchor), db);
    return anchor;
  }
  return null;
}

/** Remembers a balance the bank reported, unless a later one is already known (SMS can arrive out of order). */
export async function recordBalance(anchor: BalanceAnchor, db?: Db): Promise<void> {
  db ??= await getDb();
  const current = await readAnchor(db);
  if (current && current.at > anchor.at) return;
  await setSetting(KEY, JSON.stringify(anchor), db);
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
  // the day it's put on: the text's date, or the day it came when that date was still to come (resolveOccurredAt)
  const day = new Date(tx.occurred_at * 1000);
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
      await db.run(`UPDATE transactions SET occurred_at = ? WHERE id IN (${placeholders(ids.length)})`, [a.at - 1, ...ids]);
      return;
    }
  }
}

/**
 * Operations with only a date put at 00:00 of a day not begun before `nowMs`'s day (TBC dates a late transfer the
 * next day; before resolveOccurredAt took the time it came instead): moved to the end of the day before, then placed
 * by the balances like a new one. Migration 34.
 */
export async function placeNextDayDated(db: Db, nowMs = Date.now()): Promise<void> {
  const now = new Date(nowMs);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const rows = await db.all<{ id: number; occurred_at: number; raw_sms: string }>(
    "SELECT id, occurred_at, raw_sms FROM transactions WHERE bank != 'manual' AND occurred_at >= ?", [todayStart]);
  for (const r of rows) {
    const p = parseTbc(r.raw_sms);
    const at = new Date(r.occurred_at * 1000);
    if (!p || p.has_time || !p.occurred_at || at.getHours() !== 0 || at.getMinutes() !== 0) continue;
    await db.run('UPDATE transactions SET occurred_at = ? WHERE id = ?', [r.occurred_at - 1, r.id]);
    await placeByBalances(r.id, db);
  }
}
