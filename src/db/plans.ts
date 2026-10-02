import { getDb } from './index';

export const BUDGET_CURRENCY = 'GEL';

/** Kinds that count as spending. Refunds are subtracted; deposits are income and ignored. */
const EXPENSE_KINDS = ['purchase', 'withdrawal', 'transfer'];
const SPEND_EXPR = `sum(CASE WHEN t.kind = 'refund' THEN -t.amount_minor
  WHEN t.kind IN (${EXPENSE_KINDS.map((k) => `'${k}'`).join(',')}) THEN t.amount_minor ELSE 0 END)`;

/** Month key "2026-10". month is 0-based like Date#getMonth. */
export function ymOf(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseYm(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m - 1 };
}

/** [start, end) of a calendar month in unix seconds, local time. month is 0-based. */
export function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime() / 1000, new Date(year, month + 1, 1).getTime() / 1000];
}

export type PlanItem = {
  category_id: number;
  name: string;
  emoji: string | null;
  is_archived: number;
  /** 0 = amount not set yet this month */
  limit_minor: number;
  pinned: boolean;
  /** amount of the same item in the month this plan was carried over from (placeholder hint) */
  previous_minor: number | null;
};

/**
 * Creates the month's plan on first access by carrying items over from the latest earlier
 * planned month: pinned items keep their amount, the others come with an empty amount to fill in.
 * Past months are never initialized automatically (history must not change by looking at it).
 */
export async function ensureMonthPlan(ym: string, nowYm = currentYm()): Promise<void> {
  if (ym < nowYm) return;
  const db = await getDb();
  if (await db.get('SELECT 1 FROM plan_months WHERE ym = ?', [ym])) return;
  await db.transaction(async () => {
    const source = await db.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
    if (source) {
      await db.run(
        `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, pinned)
          SELECT ?, p.category_id, CASE WHEN p.pinned = 1 THEN p.limit_minor ELSE 0 END, p.pinned
          FROM plan_items p JOIN categories c ON c.id = p.category_id
          WHERE p.ym = ? AND c.is_archived = 0`,
        [ym, source.ym]);
    }
    await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
  });
}

export function currentYm(now = new Date()): string {
  return ymOf(now.getFullYear(), now.getMonth());
}

export async function listPlan(ym: string): Promise<PlanItem[]> {
  await ensureMonthPlan(ym);
  const db = await getDb();
  const prev = await db.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
  const rows = await db.all<Omit<PlanItem, 'pinned'> & { pinned: number }>(
    `SELECT p.category_id, c.name, c.emoji, c.is_archived, p.limit_minor, p.pinned,
        (SELECT q.limit_minor FROM plan_items q WHERE q.ym = ? AND q.category_id = p.category_id) AS previous_minor
      FROM plan_items p JOIN categories c ON c.id = p.category_id
      WHERE p.ym = ?
      ORDER BY c.sort_order, c.name`,
    [prev?.ym ?? '', ym]);
  return rows.map((r) => ({ ...r, pinned: r.pinned === 1, previous_minor: r.previous_minor || null }));
}

async function markPlanned(ym: string) {
  // editing a month (also a past one) makes it a planned month that later months carry over from
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
}

export async function addPlanItem(ym: string, categoryId: number, limitMinor = 0) {
  await ensureMonthPlan(ym);
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor) VALUES (?, ?, ?)', [ym, categoryId, limitMinor]);
  await markPlanned(ym);
}

export async function setPlanAmount(ym: string, categoryId: number, limitMinor: number) {
  const db = await getDb();
  await db.run(
    `INSERT INTO plan_items (ym, category_id, limit_minor) VALUES (?, ?, ?)
      ON CONFLICT(ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor`,
    [ym, categoryId, Math.max(0, limitMinor)]);
  await markPlanned(ym);
}

/** Pinned items move to the next month together with their amount. */
export async function setPlanPinned(ym: string, categoryId: number, pinned: boolean) {
  const db = await getDb();
  await db.run('UPDATE plan_items SET pinned = ? WHERE ym = ? AND category_id = ?', [pinned ? 1 : 0, ym, categoryId]);
}

export async function removePlanItem(ym: string, categoryId: number) {
  const db = await getDb();
  await db.run('DELETE FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
  await markPlanned(ym);
}

export type CategoryStat = {
  category_id: number | null; // null = uncategorized
  name: string;
  emoji: string | null;
  spent_minor: number;
  /** null = no plan (or amount not set) for this category this month */
  limit_minor: number | null;
  /** rank by all-time spend: keeps a category's chart color stable across months */
  color_rank: number;
};

export type MonthStats = {
  ym: string;
  spent_minor: number;
  planned_minor: number;
  categories: CategoryStat[];
  /** spending in other currencies, not included in the totals (no offline FX rates) */
  other_currencies: Array<{ currency: string; spent_minor: number }>;
};

export async function monthStats(year: number, month: number): Promise<MonthStats> {
  const ym = ymOf(year, month);
  await ensureMonthPlan(ym);
  const db = await getDb();
  const [from, to] = monthRange(year, month);

  const spent = await db.all<{ category_id: number | null; spent_minor: number }>(
    `SELECT t.category_id, ${SPEND_EXPR} AS spent_minor
      FROM transactions t
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency = ?
      GROUP BY t.category_id`, [from, to, BUDGET_CURRENCY]);
  const spentBy = new Map(spent.map((s) => [s.category_id, s.spent_minor]));

  const ranks = await db.all<{ category_id: number }>(
    `SELECT t.category_id FROM transactions t
      WHERE t.category_id IS NOT NULL AND t.currency = ?
      GROUP BY t.category_id ORDER BY ${SPEND_EXPR} DESC, t.category_id`, [BUDGET_CURRENCY]);
  const rankOf = new Map(ranks.map((r, i) => [r.category_id, i]));

  const cats = await db.all<{ id: number; name: string; emoji: string | null; limit_minor: number | null }>(
    `SELECT c.id, c.name, c.emoji, p.limit_minor
      FROM categories c LEFT JOIN plan_items p ON p.category_id = c.id AND p.ym = ?`, [ym]);

  const categories: CategoryStat[] = [];
  for (const c of cats) {
    const s = spentBy.get(c.id) ?? 0;
    const limit = c.limit_minor ? c.limit_minor : null;
    if (s === 0 && limit === null) continue;
    categories.push({
      category_id: c.id, name: c.name, emoji: c.emoji, spent_minor: s, limit_minor: limit,
      color_rank: rankOf.get(c.id) ?? Number.MAX_SAFE_INTEGER,
    });
  }
  const uncategorized = spentBy.get(null) ?? 0;
  if (uncategorized !== 0) {
    categories.push({ category_id: null, name: 'Без категории', emoji: null, spent_minor: uncategorized, limit_minor: null, color_rank: Number.MAX_SAFE_INTEGER });
  }
  categories.sort((a, b) => b.spent_minor - a.spent_minor || (b.limit_minor ?? 0) - (a.limit_minor ?? 0));

  const other = await db.all<{ currency: string; spent_minor: number }>(
    `SELECT t.currency, ${SPEND_EXPR} AS spent_minor FROM transactions t
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency != ?
      GROUP BY t.currency HAVING spent_minor != 0`, [from, to, BUDGET_CURRENCY]);

  return {
    ym,
    spent_minor: categories.reduce((sum, c) => sum + c.spent_minor, 0),
    planned_minor: categories.reduce((sum, c) => sum + (c.limit_minor ?? 0), 0),
    categories,
    other_currencies: other,
  };
}

export type HistoryMonth = { ym: string; planned_minor: number; spent_minor: number };

/** Every month from the first transaction / plan up to the current month, newest first. */
export async function planHistory(nowYm = currentYm()): Promise<HistoryMonth[]> {
  const db = await getDb();
  const first = await db.get<{ ym: string | null }>(
    `SELECT min(ym) AS ym FROM (
      SELECT strftime('%Y-%m', min(occurred_at), 'unixepoch', 'localtime') AS ym FROM transactions
      UNION ALL SELECT min(ym) FROM plan_months)`);
  if (!first?.ym) return [];

  const spent = await db.all<{ ym: string; spent_minor: number }>(
    `SELECT strftime('%Y-%m', t.occurred_at, 'unixepoch', 'localtime') AS ym, ${SPEND_EXPR} AS spent_minor
      FROM transactions t WHERE t.currency = ? GROUP BY ym`, [BUDGET_CURRENCY]);
  const planned = await db.all<{ ym: string; planned_minor: number }>(
    'SELECT ym, sum(limit_minor) AS planned_minor FROM plan_items GROUP BY ym');
  const spentBy = new Map(spent.map((r) => [r.ym, r.spent_minor]));
  const plannedBy = new Map(planned.map((r) => [r.ym, r.planned_minor]));

  const out: HistoryMonth[] = [];
  let { year, month } = parseYm(nowYm);
  for (let ym = nowYm; ym >= first.ym; ym = ymOf(year, --month)) {
    out.push({ ym, planned_minor: plannedBy.get(ym) ?? 0, spent_minor: spentBy.get(ym) ?? 0 });
  }
  return out;
}

export default {
  ymOf, parseYm, currentYm, monthRange, ensureMonthPlan, listPlan, addPlanItem, setPlanAmount,
  setPlanPinned, removePlanItem, monthStats, planHistory,
};
