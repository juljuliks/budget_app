import { getDb } from './index';
import { currentYm, monthStart } from './plans';

export type Category = {
  id: number;
  name: string;
  emoji: string | null;
  sort_order: number;
  type_id: number | null;
  type_name: string | null;
  /** 1 when the category's type is the transfer type: offered for money transfers (see isTransferCategory) */
  type_is_transfer: number;
  deleted_at: number | null;
  /** own color; null = from the type's palette (see src/colors.ts) */
  color: string | null;
  /** 'savings' for the system category "Сбережения" (can't be deleted or renamed), else null */
  system: string | null;
};

/** The system category money put aside goes to: its operations aren't spending. */
export const SAVINGS = 'savings';
export const isSavings = (c: { system?: string | null }) => c.system === SAVINGS;

/** The id of "Сбережения". */
export async function savingsCategoryId(): Promise<number | null> {
  const db = await getDb();
  return (await db.get<{ id: number }>("SELECT id FROM categories WHERE system = 'savings'"))?.id ?? null;
}

const COLUMNS = `c.id, c.name, c.emoji, c.sort_order, c.type_id, c.deleted_at, c.color, c.system,
    t.name AS type_name, coalesce(t.is_transfer, 0) AS type_is_transfer`;
const FROM = 'FROM categories c LEFT JOIN category_types t ON t.id = c.type_id';
const SELECT = `SELECT ${COLUMNS} ${FROM}`;
// typed first (in type order), untyped last
const ORDER = 'ORDER BY t.id IS NULL, t.sort_order, t.name, c.sort_order, c.name';

export function isTransferCategory(c: Pick<Category, 'type_is_transfer'>): boolean {
  return c.type_is_transfer === 1;
}

/** "💸 Переводы: Маме" */
export function categoryLabel(c: { emoji?: string | null; name: string; type_name?: string | null }): string {
  return `${c.emoji || ''} ${c.type_name ? `${c.type_name}: ` : ''}${c.name}`.trim();
}

/** Category label of a transaction row (its joined category_* columns); null when uncategorized. */
export function txCategoryLabel(tx: { category_id: number | null; category_name: string | null; category_emoji: string | null; category_type_name: string | null }): string | null {
  if (tx.category_id === null || tx.category_name === null) return null;
  return categoryLabel({ emoji: tx.category_emoji, name: tx.category_name, type_name: tx.category_type_name });
}

/** Live (not deleted) categories. */
export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.all(`${SELECT} WHERE c.deleted_at IS NULL ${ORDER}`);
}

export async function getCategory(id: number): Promise<Category | undefined> {
  const db = await getDb();
  return db.get(`${SELECT} WHERE c.id = ?`, [id]);
}

/** A category's label by its id ("🛒 Еда"); '?' if there is no such category. */
export async function categoryLabelOf(id: number): Promise<string> {
  const c = await getCategory(id);
  return c ? categoryLabel(c) : '?';
}

/** Same name within the same type among live categories; case-insensitive (Cyrillic too, hence JS). */
export async function findCategoryByName(name: string, typeId: number | null, exceptId?: number): Promise<Category | undefined> {
  const wanted = name.trim().toLowerCase();
  return (await listCategories()).find(
    (c) => c.id !== exceptId && c.type_id === typeId && c.name.trim().toLowerCase() === wanted);
}

export async function createCategory(name: string, emoji?: string | null, typeId: number | null = null, color: string | null = null): Promise<number> {
  const db = await getDb();
  // new categories go to the end of the list (before the seeded "Другое" at 99)
  const { lastInsertRowid } = await db.run(
    `INSERT INTO categories (name, emoji, type_id, color, sort_order)
      VALUES (?, ?, ?, ?, (SELECT coalesce(max(sort_order), 0) + 1 FROM categories WHERE sort_order < 99))`,
    [name.trim(), emoji?.trim() || null, typeId, color]);
  await db.run('INSERT OR REPLACE INTO category_usage (category_id, usage_count) VALUES (?, 0)', [lastInsertRowid]);
  return lastInsertRowid;
}

export async function updateCategory(id: number, fields: { name: string; emoji?: string | null; typeId: number | null; color?: string | null }) {
  const db = await getDb();
  // a system category ("Сбережения") keeps its name
  await db.run('UPDATE categories SET name = CASE WHEN system IS NULL THEN ? ELSE name END, emoji = ?, type_id = ?, color = ? WHERE id = ?',
    [fields.name.trim(), fields.emoji?.trim() || null, fields.typeId, fields.color ?? null, id]);
}

/** Transactions of the category from the current month on (those a delete would move). */
export async function currentTransactionsOfCategory(id: number, nowYm = currentYm()) {
  const db = await getDb();
  const from = monthStart(nowYm);
  return db.all<{ id: number; amount_minor: number; currency: string; kind: string; raw_merchant: string | null; occurred_at: number }>(
    `SELECT id, amount_minor, currency, kind, raw_merchant, occurred_at FROM transactions
      WHERE category_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC`, [id, from]);
}

export async function countPastTransactionsOfCategory(id: number, nowYm = currentYm()): Promise<number> {
  const db = await getDb();
  const from = monthStart(nowYm);
  return (await db.get<{ n: number }>(
    'SELECT count(*) AS n FROM transactions WHERE category_id = ? AND occurred_at < ?', [id, from]))!.n;
}

/**
 * Deletes a category from the current month on. Its transactions of the current month (and later)
 * move to `targetId` (or become uncategorized), merchant rules follow them; past months keep the
 * category so history doesn't change. A category with no past trace is removed completely.
 */
export async function deleteCategory(id: number, targetId: number | null, nowYm = currentYm()) {
  const db = await getDb();
  if ((await db.get<{ system: string | null }>('SELECT system FROM categories WHERE id = ?', [id]))?.system) {
    throw new Error('a system category cannot be deleted');
  }
  const from = monthStart(nowYm);
  await db.transaction(async (tx) => {
    // the past stays in it: its operations there that follow a merchant are fixed, so the merchant moving on
    // (below, or later) doesn't take them along
    await tx.run(
      "UPDATE transactions SET category_source = 'user' WHERE category_id = ? AND occurred_at < ? AND category_source = 'rule'", [id, from]);
    // a rule-picked one keeps following its merchant (whose rule moves along below), a hand-picked one stays so;
    // none = no source
    await tx.run(
      `UPDATE transactions SET category_id = ?, category_source = CASE WHEN ? IS NULL THEN NULL ELSE category_source END
        WHERE category_id = ? AND occurred_at >= ?`,
      [targetId, targetId, id, from]);
    if (targetId === null) {
      await tx.run('DELETE FROM merchant_rules WHERE category_id = ?', [id]);
    } else {
      await tx.run('UPDATE merchant_rules SET category_id = ? WHERE category_id = ?', [targetId, id]);
      await tx.run('UPDATE OR IGNORE merchant_categories SET category_id = ? WHERE category_id = ?', [targetId, id]);
    }
    await tx.run('DELETE FROM merchant_categories WHERE category_id = ?', [id]);
    await tx.run('DELETE FROM plan_items WHERE category_id = ? AND ym >= ?', [id, nowYm]);
    await tx.run('DELETE FROM category_usage WHERE category_id = ?', [id]);

    const pastTx = await tx.get('SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1', [id]);
    const pastPlan = await tx.get('SELECT 1 FROM plan_items WHERE category_id = ? LIMIT 1', [id]);
    if (pastTx || pastPlan) {
      await tx.run('UPDATE categories SET deleted_at = ? WHERE id = ?', [Math.floor(Date.now() / 1000), id]);
    } else {
      await tx.run('DELETE FROM categories WHERE id = ?', [id]);
    }
  });
}

/**
 * Deleting a category, step by step: these transactions (of the category being deleted) move to `toId`
 * (null = none), and their merchants' rules pointing to the deleted category follow them.
 */
export async function moveTransactionsOutOfCategory(txIds: number[], fromId: number, toId: number | null) {
  if (txIds.length === 0) return;
  const db = await getDb();
  const marks = txIds.map(() => '?').join(',');
  await db.transaction(async (tx) => {
    const keys = (await tx.all<{ k: string }>(
      `SELECT DISTINCT merchant_key AS k FROM transactions
        WHERE id IN (${marks}) AND category_id = ? AND merchant_key IS NOT NULL`,
      [...txIds, fromId])).map((r) => r.k);
    // a rule-picked one keeps following its merchant (whose rule moves along); none = no source
    await tx.run(
      `UPDATE transactions SET category_id = ?, category_source = CASE WHEN ? IS NULL THEN NULL ELSE category_source END
        WHERE id IN (${marks}) AND category_id = ?`,
      [toId, toId, ...txIds, fromId]);
    if (keys.length > 0) {
      const keyMarks = keys.map(() => '?').join(',');
      if (toId === null) {
        await tx.run(`DELETE FROM merchant_rules WHERE category_id = ? AND match_type = 'exact' AND pattern IN (${keyMarks})`, [fromId, ...keys]);
      } else {
        await tx.run(`UPDATE merchant_rules SET category_id = ? WHERE category_id = ? AND match_type = 'exact' AND pattern IN (${keyMarks})`, [toId, fromId, ...keys]);
      }
    }
  });
  if (toId !== null) await incrementCategoryUsage(toId);
}

export async function incrementCategoryUsage(categoryId: number, by = 1) {
  const db = await getDb();
  await db.run(
    `INSERT INTO category_usage (category_id, usage_count) VALUES (?, ?)
      ON CONFLICT(category_id) DO UPDATE SET usage_count = usage_count + excluded.usage_count`,
    [categoryId, by]);
}

/** How many times each category was chosen (category id → count). */
export async function categoryUsageCounts(): Promise<Map<number, number>> {
  const db = await getDb();
  const rows = await db.all<{ category_id: number; usage_count: number }>('SELECT category_id, usage_count FROM category_usage');
  return new Map(rows.map((r) => [r.category_id, r.usage_count]));
}

/** Most used live categories first. */
export async function topCategories(limit = 3): Promise<Array<Category & { usage_count: number }>> {
  const db = await getDb();
  return db.all(`SELECT ${COLUMNS}, coalesce(u.usage_count, 0) AS usage_count
    ${FROM}
    LEFT JOIN category_usage u ON u.category_id = c.id
    WHERE c.deleted_at IS NULL
    ORDER BY usage_count DESC, c.sort_order ASC, c.name ASC
    LIMIT ?`, [limit]);
}

export default {
  listCategories, getCategory, findCategoryByName, createCategory, updateCategory, deleteCategory,
  currentTransactionsOfCategory, countPastTransactionsOfCategory, moveTransactionsOutOfCategory, incrementCategoryUsage, topCategories,
  isTransferCategory, categoryLabel, txCategoryLabel,
};

/**
 * A category's operations count and what was spent in it, per currency: purchases, payments, transfers, cash
 * withdrawals minus refunds not settled on a purchase (like the stats); deposits aren't spending.
 */
export async function categorySummary(categoryId: number): Promise<{ count: number; totals: Array<{ currency: string; amount_minor: number }> }> {
  const db = await getDb();
  const count = (await db.get<{ n: number }>('SELECT count(*) AS n FROM transactions WHERE category_id = ?', [categoryId]))!.n;
  const totals = await db.all<{ currency: string; amount_minor: number }>(
    `SELECT currency, sum(CASE WHEN kind = 'refund' THEN -amount_minor ELSE amount_minor END) AS amount_minor FROM transactions
      WHERE category_id = ? AND (kind IN ('purchase', 'payment', 'transfer', 'withdrawal') OR (kind = 'refund' AND refund_settled_at IS NULL))
      GROUP BY currency HAVING sum(CASE WHEN kind = 'refund' THEN -amount_minor ELSE amount_minor END) != 0
      ORDER BY amount_minor DESC`, [categoryId]);
  return { count, totals };
}
