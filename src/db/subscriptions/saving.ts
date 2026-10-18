// Saving up for a subscription ("Откладывать каждый месяц?"), from the database. Its contributions are the spending of
// "Подписки" in their months (the plan's item has them), a charge paid from what was saved is not; turned off or
// deleted, what it had goes back to that month (its savings). See savingLedger.ts for the months' sums.
import { getDb } from '../index';
import type { Db } from '../types';
import { Currency } from '../fx';
import { asCurrency, currentYm, monthRange, monthStart, parseYm } from '../plans/months';
import { convertSpending } from '../plans/spend';
import { chargeDays, dayOfUnix } from './reads';
import { savingFor } from './schedule';
import { SavingMonth, savingMonths, ymBefore } from './savingLedger';

export type Saving = {
  id: number;
  sub_id: number;
  since_ym: string;
  /** "Уже отложено" */
  start_minor: number;
  /** when it was made (unix): the charges before aren't its */
  created_at: number;
  /** turned off (or the subscription deleted) in this month: counts up to the month before */
  closed_ym: string | null;
  /** what it had then: that month's savings */
  released_minor: number | null;
  /** its subscription (deleted ones too) */
  merchant_key: string | null;
  name: string;
  amount_minor: number;
  currency: Currency;
  period_months: number;
  due: string | null;
};

export type SavingLedger = { saving: Saving; months: SavingMonth[]; balance: number; byTx: Map<number, { before: number; after: number }> };

type Row = Omit<Saving, 'currency'> & { currency: string };
const COLUMNS = `v.id, v.sub_id, v.since_ym, v.start_minor, v.closed_ym, v.released_minor, v.created_at,
  s.merchant_key, s.name, s.amount_minor, s.currency, s.period_months, s.due`;
const asSaving = (r: Row): Saving => ({ ...r, currency: asCurrency(r.currency) });

/** The savings that count in `ym`: started by then, not closed before it (one closed in it gives back what it had). */
export async function savingsIn(ym: string, db?: Db): Promise<Saving[]> {
  db ??= await getDb();
  return (await db.all<Row>(
    `SELECT ${COLUMNS} FROM sub_savings v JOIN subscriptions s ON s.id = v.sub_id
      WHERE v.since_ym <= ? AND (v.closed_ym IS NULL OR v.closed_ym >= ?)`, [ym, ym])).map(asSaving);
}

/** Every saving ever (closed ones too): the history counts their months. */
export async function allSavings(): Promise<Saving[]> {
  return (await (await getDb()).all<Row>(`SELECT ${COLUMNS} FROM sub_savings v JOIN subscriptions s ON s.id = v.sub_id`)).map(asSaving);
}

/** The subscription's saving now (not turned off), or null. */
export async function openSaving(subId: number, db?: Db): Promise<Saving | null> {
  db ??= await getDb();
  const r = await db.get<Row>(`SELECT ${COLUMNS} FROM sub_savings v JOIN subscriptions s ON s.id = v.sub_id WHERE v.sub_id = ? AND v.closed_ym IS NULL`, [subId]);
  return r ? asSaving(r) : null;
}

/** The saving month by month up to `until` (a closed one: the month before it was closed). */
export async function savingLedger(v: Saving, until = currentYm(), nowYm = currentYm(), db?: Db): Promise<SavingLedger> {
  db ??= await getDb();
  const last = v.closed_ym && v.closed_ym <= until ? ymBefore(v.closed_ym) : until;
  if (last < v.since_ym) return { saving: v, months: [], balance: v.start_minor, byTx: new Map() };
  const stored = new Map((await db.all<{ ym: string; minor: number }>(
    'SELECT ym, minor FROM sub_contributions WHERE saving_id = ? AND ym <= ?', [v.id, last])).map((r) => [r.ym, r.minor]));
  const planned = new Set((await db.all<{ ym: string }>(
    'SELECT ym FROM plan_months WHERE ym >= ? AND ym <= ?', [v.since_ym, last])).map((r) => r.ym));
  const { year, month } = parseYm(last);
  const rows = !v.merchant_key ? [] : await db.all<{ id: number; category_id: number | null; kind: string; amount_minor: number; currency: string; occurred_at: number; refund_settled_at: number | null }>(
    `SELECT id, category_id, kind, amount_minor, currency, occurred_at, refund_settled_at FROM spend_parts
      WHERE merchant_key = ? AND category_id = (SELECT id FROM categories WHERE system = 'subs') AND occurred_at >= ? AND occurred_at < ?
      ORDER BY occurred_at, id`, [v.merchant_key, Math.max(monthStart(v.since_ym), v.created_at), monthRange(year, month)[1]]);
  const { items } = await convertSpending(rows, v.currency);
  const ops = v.merchant_key ? (await chargeDays([v.merchant_key], db)).get(v.merchant_key) ?? [] : [];
  const r = savingMonths({
    since: v.since_ym, last, nowYm, start: v.start_minor, amount: v.amount_minor, planned: (ym) => planned.has(ym), stored,
    dueOf: (ym) => (v.due ? savingFor(v.due, v.period_months, ym, ops, v.created_at ? dayOfUnix(v.created_at) : '') : null),
    spends: items.map(({ row, value }) => ({ id: row.id, at: row.occurred_at, value })),
  });
  return { saving: v, ...r };
}

/** A saving's effect on "Подписки" in a month, in its currency: + the contribution, − what the saved money paid, − what it gave back. */
export type SavingEffect = { saving: Saving; month: SavingMonth | null; released: number; minor: number; currency: Currency };

/** The month's savings and what each changes the spending of "Подписки" by. */
export async function savingEffects(ym: string, nowYm = currentYm(), db?: Db): Promise<SavingEffect[]> {
  db ??= await getDb();
  const out: SavingEffect[] = [];
  for (const v of await savingsIn(ym, db)) {
    const month = (await savingLedger(v, ym, nowYm, db)).months.find((m) => m.ym === ym) ?? null;
    const released = v.closed_ym === ym ? v.released_minor ?? 0 : 0;
    const minor = (month ? month.contribution - (month.spent - month.shortage) : 0) - released;
    out.push({ saving: v, month, released, minor, currency: v.currency });
  }
  return out;
}

/**
 * What the month's savings change "Подписки"'s spending by, converted by `toShown`: its category and the sum; null —
 * nothing (no saving: one look).
 */
export async function savingSpend(ym: string, toShown: (minor: number, from: Currency) => number): Promise<{ category_id: number; minor: number } | null> {
  const db = await getDb();
  const effects = (await savingEffects(ym, currentYm(), db)).filter((e) => e.minor !== 0);
  if (!effects.length) return null;
  const id = (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'subs'"))?.id;
  return id === undefined ? null : { category_id: id, minor: effects.reduce((a, e) => a + toShown(e.minor, e.currency), 0) };
}

/**
 * An operation of a subscription saved up for, paid from what was saved: what the saving had before it and after, and
 * the subscription's name; null — not paid from a saving.
 */
export async function savingOfTransaction(txId: number, merchantKey: string | null, occurredAt: number):
  Promise<{ before: number; after: number; currency: Currency; name: string } | null> {
  if (!merchantKey) return null;
  const db = await getDb();
  const d = new Date(occurredAt * 1000);
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rows = (await db.all<Row>(
    `SELECT ${COLUMNS} FROM sub_savings v JOIN subscriptions s ON s.id = v.sub_id
      WHERE s.merchant_key = ? AND v.since_ym <= ? AND (v.closed_ym IS NULL OR v.closed_ym > ?)`, [merchantKey, ym, ym])).map(asSaving);
  for (const v of rows) {
    const at = (await savingLedger(v, ym, currentYm(), db)).byTx.get(txId);
    if (at) return { ...at, currency: v.currency, name: v.name };
  }
  return null;
}

/** The current and coming months' contributions kept as their plans have them (read once the month is past). */
export async function storeContributions(ym: string, nowYm = currentYm(), db?: Db): Promise<void> {
  if (ym < nowYm) return;
  db ??= await getDb();
  for (const e of await savingEffects(ym, nowYm, db)) {
    if (!e.month) continue;
    await db.run(
      'INSERT INTO sub_contributions (saving_id, ym, minor) VALUES (?, ?, ?) ON CONFLICT (saving_id, ym) DO UPDATE SET minor = excluded.minor',
      [e.saving.id, ym, e.month.contribution]);
  }
}
