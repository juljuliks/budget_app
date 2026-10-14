// What "＋" on the plan offers: the categories not in the month's plan yet, in the order they are likely added.
import { Category, isSystemCategory, listCategories } from '../categories';
import { getDb } from '../index';
import { Currency } from '../fx';
import { asCurrency, monthRange, parseYm, ymOf } from './months';
import { categoryKey, convertSpending, spendRows, sumBy } from './spend';

/** 'last': in the month before's plan; 'spent': spent in this month; 'other': the rest */
export type AddableGroup = 'last' | 'spent' | 'other';

export type AddableCategory = Category & {
  group: AddableGroup;
  /** its plan in the month before, in the currency it was entered in */
  last: { limit_minor: number; currency: Currency } | null;
  /** spent in this month, in `currency` */
  spent_minor: number;
};

/**
 * The categories not in `ym`'s plan ("Сбережения", "Пополнение счёта" and the like never are): those of the month
 * before's plan first, then those spent in this month, then the rest — each group in the categories' order.
 */
export async function addableCategories(ym: string, currency: Currency): Promise<AddableCategory[]> {
  const db = await getDb();
  const { year, month } = parseYm(ym);
  const [planned, last, cats, rows] = await Promise.all([
    db.all<{ category_id: number }>('SELECT category_id FROM plan_items WHERE ym = ?', [ym]),
    db.all<{ category_id: number; limit_minor: number; currency: string }>(
      'SELECT category_id, limit_minor, currency FROM plan_items WHERE ym = ? AND limit_minor > 0', [ymOf(year, month - 1)]),
    listCategories(),
    spendRows(...monthRange(year, month)),
  ]);
  const inPlan = new Set(planned.map((p) => p.category_id));
  const lastOf = new Map(last.map((l) => [l.category_id, { limit_minor: l.limit_minor, currency: asCurrency(l.currency) }]));
  const spent = sumBy((await convertSpending(rows, currency)).items, categoryKey);
  const order: AddableGroup[] = ['last', 'spent', 'other'];
  return cats
    .filter((c) => !inPlan.has(c.id) && !isSystemCategory(c))
    .map((c): AddableCategory => {
      const spentMinor = Math.max(0, spent.get(c.id) ?? 0);
      const l = lastOf.get(c.id) ?? null;
      return { ...c, last: l, spent_minor: spentMinor, group: l ? 'last' : spentMinor > 0 ? 'spent' : 'other' };
    })
    // stable: the categories' order inside a group
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}
