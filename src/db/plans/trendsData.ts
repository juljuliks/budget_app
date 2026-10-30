// What the dynamics of the spending are counted from, read once: the categories and their spending by day and merchant.
import { getDb } from '../index';
import { Currency, dateKey } from '../fx';
import { categoryColors } from '../colors';
import { NEUTRAL_COLOR } from '../../domain/colors';
import { currentYm, monthStart, ymOf } from './months';
import { convertSpending, spendRows } from './spend';

export type TrendCategory = {
  id: number; name: string; emoji: string | null; type_name: string | null; color: string;
  /**
   * its spending is put against its usual one: not a regular payment, a subscription, a fund or "крупно, раз в месяц"
   * (this month's plan) — paid on a day, they'd be "+100%" before it and "−100%" after — and not a transfer
   */
  compared: boolean;
};

/** One operation's spending (a refund or money back: negative), converted. */
export type TrendSpend = { category: number; day: string; value: number; merchantKey: string | null; merchant: string | null };

export type TrendsData = {
  categories: TrendCategory[];
  /** the last `months` months up to today, oldest first; refunds without a category and the uncategorized left out */
  spends: TrendSpend[];
  /** the first day anything was recorded ('YYYY-MM-DD'): before it there's no "usual" */
  since: string | null;
};

/** The categories, and the spending of the last `months` months (the current one so far) in `currency`. */
export async function trendsData(currency: Currency, months = 12, now = new Date()): Promise<TrendsData> {
  const db = await getDb();
  const from = monthStart(ymOf(now.getFullYear(), now.getMonth() - (months - 1)));
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000;
  const { items } = await convertSpending(await spendRows(from, to), currency);
  const spends: TrendSpend[] = [];
  for (const { row, value } of items) {
    if (row.category_id === null) continue;
    spends.push({ category: row.category_id, day: dateKey(row.occurred_at), value, merchantKey: row.merchant_key ?? null, merchant: row.raw_merchant ?? null });
  }

  const rows = await db.all<{ id: number; name: string; emoji: string | null; type_name: string | null; transfer: number; recurring: number }>(
    `SELECT c.id, c.name, c.emoji, t.name AS type_name, coalesce(t.is_transfer, 0) AS transfer, c.recurring
      FROM categories c LEFT JOIN category_types t ON t.id = c.type_id
      WHERE c.deleted_at IS NULL ORDER BY t.id IS NULL, t.sort_order, t.name, c.sort_order, c.name`);
  // paid once in a while: compared by whole months only, not by the days so far
  const once = new Set((await db.all<{ category_id: number }>(
    `SELECT category_id FROM plan_items WHERE ym = ?
      AND (kind IN ('fixed', 'subs', 'fund') OR (kind = 'limit' AND norm_period = 'month'))`, [currentYm(now)])).map((r) => r.category_id));
  const colorOf = await categoryColors();
  const categories = rows.map((c) => ({
    id: c.id, name: c.name, emoji: c.emoji, type_name: c.type_name, color: colorOf.get(c.id) ?? NEUTRAL_COLOR,
    compared: !c.transfer && !c.recurring && !once.has(c.id),
  }));
  const first = await db.get<{ at: number | null }>('SELECT min(occurred_at) AS at FROM transactions');
  return { categories, spends, since: first?.at == null ? null : dateKey(first.at) };
}
