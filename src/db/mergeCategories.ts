import { getDb } from './index';
import { Category, findCategoryByName, isSavings, listCategories } from './categories';
import { currentYm, NormPeriod, planConverter, PlanKind } from './plans';

/** How a merged category is planned: a limit with its spending pattern, or an obligatory payment. */
export type MergeRhythm = { kind: PlanKind; norm: NormPeriod };

export class MergeNameTakenError extends Error {
  constructor(public readonly name: string) { super(`a category named "${name}" already exists in this section`); }
}

type Item = { ym: string; category_id: number; limit_minor: number; currency: string; kind: PlanKind; norm_period: NormPeriod; pinned: number };

/**
 * Merges `sourceIds` into `targetId`, history included: every month's operations and plan, the merchants' rules and
 * the usage move to the target, which takes `name` and `typeId`; the sources are removed. A month's plan amounts are
 * summed (in the target's currency there, else the first one's, at that month's plan rate); `rhythm` — how the merged
 * item is planned — applies to every merged month, else the target's (or the first source's) kind and pattern stay.
 */
export async function mergeCategories(targetId: number, sourceIds: number[], name: string, typeId: number | null, rhythm: MergeRhythm | null) {
  const sources = sourceIds.filter((id) => id !== targetId);
  if (sources.length === 0) return;
  const all = [targetId, ...sources];
  const cats = (await listCategories()).filter((c) => all.includes(c.id));
  if (cats.some(isSavings)) throw new Error('the savings category cannot be merged');
  const clash = await findCategoryByName(name, typeId, targetId);
  if (clash && !all.includes(clash.id)) throw new MergeNameTakenError(name.trim());

  const db = await getDb();
  const marks = all.map(() => '?').join(',');
  const items = await db.all<Item>(
    `SELECT ym, category_id, limit_minor, currency, kind, norm_period, pinned FROM plan_items WHERE category_id IN (${marks}) ORDER BY ym`, all);
  // each month's merged item, computed before the transaction (the rates may need loading)
  const merged: Item[] = [];
  for (const ym of [...new Set(items.map((i) => i.ym))]) {
    const month = items.filter((i) => i.ym === ym);
    const own = month.find((i) => i.category_id === targetId) ?? month[0];
    const conv = month.some((i) => i.currency !== own.currency) ? await planConverter(ym) : null;
    // without a rate an amount is taken as it is: better than dropping it from the plan
    const sum = month.reduce((a, i) => a + (i.currency === own.currency ? i.limit_minor : conv?.(i.limit_minor, i.currency, own.currency) ?? i.limit_minor), 0);
    merged.push({
      ym, category_id: targetId, limit_minor: Math.round(sum), currency: own.currency,
      kind: rhythm?.kind ?? own.kind, norm_period: rhythm?.norm ?? own.norm_period,
      pinned: month.some((i) => i.pinned) ? 1 : 0,
    });
  }

  const sourceMarks = sources.map(() => '?').join(',');
  await db.transaction(async (tx) => {
    await tx.run(`UPDATE transactions SET category_id = ? WHERE category_id IN (${sourceMarks})`, [targetId, ...sources]);
    await tx.run(`UPDATE merchant_rules SET category_id = ? WHERE category_id IN (${sourceMarks})`, [targetId, ...sources]);
    await tx.run(`DELETE FROM plan_items WHERE category_id IN (${marks})`, all);
    for (const m of merged) {
      await tx.run(
        'INSERT INTO plan_items (ym, category_id, limit_minor, currency, kind, norm_period, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [m.ym, m.category_id, m.limit_minor, m.currency, m.kind, m.norm_period, m.pinned]);
    }
    const usage = await tx.get<{ n: number }>(`SELECT coalesce(sum(usage_count), 0) AS n FROM category_usage WHERE category_id IN (${marks})`, all);
    await tx.run(`DELETE FROM category_usage WHERE category_id IN (${marks})`, all);
    await tx.run('INSERT INTO category_usage (category_id, usage_count) VALUES (?, ?)', [targetId, usage?.n ?? 0]);
    await tx.run('UPDATE categories SET name = ?, type_id = ? WHERE id = ?', [name.trim(), typeId, targetId]);
    // nothing refers to them any more: gone, not just hidden
    await tx.run(`DELETE FROM categories WHERE id IN (${sourceMarks})`, sources);
  });
}

/** What the merge sheet offers: the categories' this-month plan items (kind, pattern, amount in its currency). */
export async function mergePlanPreview(ids: number[], ym = currentYm()) {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.all<{ category_id: number; limit_minor: number; currency: string; kind: PlanKind; norm_period: NormPeriod }>(
    `SELECT category_id, limit_minor, currency, kind, norm_period FROM plan_items WHERE ym = ? AND category_id IN (${ids.map(() => '?').join(',')})`,
    [ym, ...ids]);
}

/** "Кафе & Рестораны": the default name of a merge, in the order picked. */
export function mergedName(cats: Pick<Category, 'name'>[]): string {
  return cats.map((c) => c.name.trim()).join(' & ');
}
