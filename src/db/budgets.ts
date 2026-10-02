import { getDb } from './index';

export const BUDGET_CURRENCY = 'GEL';

/** Kinds that count as spending. Refunds are subtracted; deposits are income and ignored. */
const EXPENSE_KINDS = ['purchase', 'withdrawal', 'transfer'];

export async function listBudgets(): Promise<Array<{ category_id: number; limit_minor: number }>> {
  const db = await getDb();
  return db.all('SELECT category_id, limit_minor FROM budgets');
}

/** limitMinor null or 0 removes the plan for the category. */
export async function setBudget(categoryId: number, limitMinor: number | null) {
  const db = await getDb();
  if (!limitMinor || limitMinor <= 0) {
    await db.run('DELETE FROM budgets WHERE category_id = ?', [categoryId]);
  } else {
    await db.run(
      `INSERT INTO budgets (category_id, limit_minor, currency) VALUES (?, ?, ?)
        ON CONFLICT(category_id) DO UPDATE SET limit_minor = excluded.limit_minor`,
      [categoryId, limitMinor, BUDGET_CURRENCY]);
  }
}

/** [start, end) of a calendar month in unix seconds, local time. month is 0-based. */
export function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime() / 1000, new Date(year, month + 1, 1).getTime() / 1000];
}

export type CategoryStat = {
  category_id: number | null; // null = uncategorized
  name: string;
  emoji: string | null;
  spent_minor: number;
  limit_minor: number | null;
  /** rank by all-time spend: keeps a category's chart color stable across months */
  color_rank: number;
};

export type MonthStats = {
  spent_minor: number;
  planned_minor: number;
  categories: CategoryStat[];
  /** spending in other currencies, not included in the totals (no offline FX rates) */
  other_currencies: Array<{ currency: string; spent_minor: number }>;
};

const SPEND_EXPR = `sum(CASE WHEN t.kind = 'refund' THEN -t.amount_minor
  WHEN t.kind IN (${EXPENSE_KINDS.map((k) => `'${k}'`).join(',')}) THEN t.amount_minor ELSE 0 END)`;

export async function monthStats(year: number, month: number): Promise<MonthStats> {
  const db = await getDb();
  const [from, to] = monthRange(year, month);

  const spent = await db.all<{ category_id: number | null; spent_minor: number }>(
    `SELECT t.category_id, ${SPEND_EXPR} AS spent_minor
      FROM transactions t
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency = ?
      GROUP BY t.category_id`, [from, to, BUDGET_CURRENCY]);

  const ranks = await db.all<{ category_id: number }>(
    `SELECT t.category_id FROM transactions t
      WHERE t.category_id IS NOT NULL AND t.currency = ?
      GROUP BY t.category_id ORDER BY ${SPEND_EXPR} DESC, t.category_id`, [BUDGET_CURRENCY]);
  const rankOf = new Map(ranks.map((r, i) => [r.category_id, i]));

  // every active category with a plan or with spending this month, plus archived ones that had spending
  const cats = await db.all<{ id: number; name: string; emoji: string | null; is_archived: number; limit_minor: number | null }>(
    `SELECT c.id, c.name, c.emoji, c.is_archived, b.limit_minor
      FROM categories c LEFT JOIN budgets b ON b.category_id = c.id`);
  const spentBy = new Map(spent.map((s) => [s.category_id, s.spent_minor]));

  const categories: CategoryStat[] = [];
  for (const c of cats) {
    const s = spentBy.get(c.id) ?? 0;
    if (s === 0 && (c.limit_minor == null || c.is_archived)) continue;
    categories.push({
      category_id: c.id, name: c.name, emoji: c.emoji, spent_minor: s, limit_minor: c.limit_minor,
      color_rank: rankOf.get(c.id) ?? Number.MAX_SAFE_INTEGER,
    });
  }
  const uncategorized = spentBy.get(null) ?? 0;
  if (uncategorized !== 0) {
    categories.push({ category_id: null, name: 'Без категории', emoji: null, spent_minor: uncategorized, limit_minor: null, color_rank: Number.MAX_SAFE_INTEGER });
  }
  categories.sort((a, b) => b.spent_minor - a.spent_minor);

  const other = await db.all<{ currency: string; spent_minor: number }>(
    `SELECT t.currency, ${SPEND_EXPR} AS spent_minor FROM transactions t
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency != ?
      GROUP BY t.currency HAVING spent_minor != 0`, [from, to, BUDGET_CURRENCY]);

  return {
    spent_minor: categories.reduce((sum, c) => sum + c.spent_minor, 0),
    planned_minor: cats.reduce((sum, c) => sum + (c.is_archived ? 0 : c.limit_minor ?? 0), 0),
    categories,
    other_currencies: other,
  };
}

export default { listBudgets, setBudget, monthStats, monthRange };
