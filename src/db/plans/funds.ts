// "Копилки": a category saved up for — how much by when. Every month with a plan puts a contribution in it (its plan
// item, kind 'fund'): what is left to save over the months left, in whole units. Its spending is taken from what is saved;
// spending past it is the month's (a shortage, over the plan). A past month's contribution is what its close said went in
// ("Итоги месяца", fund_confirms; no answer — nothing); the current one and the coming ones are counted again as the
// spending changes. Deleted: what was saved goes to that month's savings.
import { getDb } from '../index';
import type { Db } from '../types';
import { Currency } from '../fx';
import { asCurrency, currentYm, monthRange, monthStart, parseYm, ymOf } from './months';
import { convertSpending, spendRows } from './spend';

export type Fund = {
  category_id: number;
  /** how much to save, in `currency` */
  target_minor: number;
  currency: Currency;
  /** by when, 'YYYY-MM-DD' */
  due: string;
  /** saved before the app (Уже отложено) */
  start_minor: number;
  /** the month it was made in: its contributions and spending count from it */
  since_ym: string;
  /** deleted in this month: counts up to the month before it */
  closed_ym: string | null;
  /** what was saved when deleted: that month's savings */
  released_minor: number | null;
};

/** A month of a fund: its contribution, what was spent from it, what the spending took past what was saved. */
export type FundMonth = { ym: string; contribution: number; spent: number; shortage: number; start: number; end: number };

export type FundLedger = {
  fund: Fund; months: FundMonth[]; balance: number;
  /** each operation's (its part's) spending from it: what the fund had before and after it */
  byTx: Map<number, { before: number; after: number }>;
};

const nextYm = (ym: string) => { const { year, month } = parseYm(ym); return ymOf(year, month + 1); };

/** Months from `from` to `to` inclusive (0 if `to` is before). */
export function monthsBetween(from: string, to: string): number {
  const a = parseYm(from);
  const b = parseYm(to);
  return Math.max(0, (b.year - a.year) * 12 + (b.month - a.month) + 1);
}

/** A month's contribution: what is left to save over the months left (with the due month), rounded up to whole units. */
export function contributionOf(fund: Pick<Fund, 'target_minor' | 'due'>, ym: string, saved: number): number {
  const left = monthsBetween(ym, fund.due.slice(0, 7));
  if (left === 0) return 0;
  const need = Math.max(0, fund.target_minor - saved);
  return Math.ceil(need / left / 100) * 100;
}

type FundRow = Omit<Fund, 'currency'> & { currency: string };
const asFund = (r: FundRow): Fund => ({ ...r, currency: asCurrency(r.currency) });

export async function getFund(categoryId: number, db?: Db): Promise<Fund | null> {
  db ??= await getDb();
  const r = await db.get<FundRow>('SELECT * FROM funds WHERE category_id = ?', [categoryId]);
  return r ? asFund(r) : null;
}

/** The funds that count in `ym`: made by then, not deleted before or in it. */
export async function activeFunds(ym: string, db?: Db): Promise<Fund[]> {
  db ??= await getDb();
  const rows = await db.all<FundRow>('SELECT * FROM funds WHERE since_ym <= ? AND (closed_ym IS NULL OR closed_ym > ?)', [ym, ym]);
  return rows.map(asFund);
}

/** Every fund ever made (deleted ones too): the history counts their months. */
export async function allFunds(): Promise<Fund[]> {
  return (await (await getDb()).all<FundRow>('SELECT * FROM funds')).map(asFund);
}

/**
 * The fund month by month from its start up to `until` (the current month by default; a deleted one: the month before
 * it was deleted). A past month's contribution is what its close confirmed went in (none yet: nothing); the current
 * one's and the coming ones' are counted from what is saved at their start. A month without a plan item puts nothing in.
 */
export async function fundLedger(fund: Fund, until = currentYm(), nowYm = currentYm()): Promise<FundLedger> {
  const db = await getDb();
  const last = fund.closed_ym && fund.closed_ym <= until ? ymBefore(fund.closed_ym) : until;
  const items = new Map((await db.all<{ ym: string; limit_minor: number }>(
    "SELECT ym, limit_minor FROM plan_items WHERE category_id = ? AND kind = 'fund' AND ym >= ? AND ym <= ?",
    [fund.category_id, fund.since_ym, last])).map((r) => [r.ym, r.limit_minor]));
  const confirmed = new Map((await db.all<{ ym: string; saved_minor: number }>(
    'SELECT ym, saved_minor FROM fund_confirms WHERE category_id = ? AND ym >= ? AND ym <= ?',
    [fund.category_id, fund.since_ym, last])).map((r) => [r.ym, r.saved_minor]));
  const { year: ly, month: lm } = parseYm(last);
  const rows = last < fund.since_ym ? [] : await spendRows(monthStart(fund.since_ym), monthRange(ly, lm)[1], { categories: [fund.category_id] });
  const { items: spent } = await convertSpending(rows.filter((r) => r.category_id === fund.category_id), fund.currency);
  spent.sort((a, b) => a.row.occurred_at - b.row.occurred_at);

  const months: FundMonth[] = [];
  const byTx = new Map<number, { before: number; after: number }>();
  let balance = fund.start_minor;
  let i = 0;
  for (let ym = fund.since_ym; ym <= last; ym = nextYm(ym)) {
    const start = balance;
    const planned = items.get(ym);
    const contribution = ym < nowYm ? confirmed.get(ym) ?? 0 : planned === undefined ? 0 : contributionOf(fund, ym, balance);
    balance += contribution;
    const [, end] = monthRange(parseYm(ym).year, parseYm(ym).month);
    let out = 0;
    let shortage = 0;
    for (; i < spent.length && spent[i].row.occurred_at < end; i++) {
      const v = spent[i].value;
      const before = balance;
      out += v;
      // a refund puts back; spending past what is saved is the month's
      if (v > balance) { shortage += v - balance; balance = 0; } else balance -= v;
      byTx.set(spent[i].row.id, { before, after: balance });
    }
    months.push({ ym, contribution, spent: out, shortage, start, end: balance });
  }
  return { fund, months, balance, byTx };
}

export const ymBefore = (ym: string) => { const { year, month } = parseYm(ym); return ymOf(year, month - 1); };

/**
 * The current and the coming months' contributions as the ledger counts them now (the spending changed what is left to
 * save): written to their plan items. A fund is in each of them, as a repeating payment (also one made after the month
 * was planned). Past months are left as they were.
 */
export async function refreshFundItems(ym: string, nowYm = currentYm()): Promise<void> {
  if (ym < nowYm) return;
  const db = await getDb();
  const funds = await activeFunds(ym, db);
  for (const fund of funds) {
    await db.run(
      `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, kind, currency)
        SELECT ?, id, 0, 'fund', ? FROM categories WHERE id = ? AND deleted_at IS NULL`, [ym, fund.currency, fund.category_id]);
  }
  for (const fund of funds) {
    const { months } = await fundLedger(fund, ym, nowYm);
    for (const m of months) {
      if (m.ym < nowYm) continue;
      await db.run("UPDATE plan_items SET limit_minor = ?, currency = ? WHERE ym = ? AND category_id = ? AND kind = 'fund' AND limit_minor != ?",
        [m.contribution, fund.currency, m.ym, fund.category_id, m.contribution]);
    }
  }
}

/** What the fund has now (up to the current month, its spending in it too). */
export async function fundBalance(fund: Fund): Promise<number> {
  return (await fundLedger(fund)).balance;
}

/** An operation in a fund's category: the fund's name and what it had before and after it; null — not a fund's. */
export async function fundOfTransaction(txId: number, categoryId: number | null, occurredAt: number): Promise<{ before: number; after: number; currency: Currency } | null> {
  if (categoryId === null) return null;
  const fund = await getFund(categoryId);
  const d = new Date(occurredAt * 1000);
  const ym = ymOf(d.getFullYear(), d.getMonth());
  if (!fund || ym < fund.since_ym || (fund.closed_ym && ym >= fund.closed_ym)) return null;
  const at = (await fundLedger(fund, ym)).byTx.get(txId);
  return at ? { ...at, currency: fund.currency } : null;
}
