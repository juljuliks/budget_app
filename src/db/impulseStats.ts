// What impulsive purchases are counted from, read once for a period: the purchases and payments asked about (a category
// with "Импульсивные покупки" on) or answered, each part of a split one in its own category, converted.
import { getDb } from './index';
import { Currency, dateKey } from './fx';
import { convertSpending, SpendRow } from './plans/spend';
import { REMEMBERABLE_KINDS } from '../domain/types';
import { sqlList } from './sql';
import { UNANSWERED_SQL } from './impulse';

/** One purchase's part: its category's share of it, converted. */
export type ImpulseRow = {
  tx: number;
  category: number | null;
  /** 'YYYY-MM-DD' */
  day: string;
  value: number;
  /** true — "Импульсивная", false — "Обдуманная", null — no answer */
  impulse: boolean | null;
  /** an impulsive one's "Что подтолкнуло?" (a mood id) */
  mood: string | null;
  merchantKey: string | null;
  merchant: string | null;
};

type Raw = SpendRow & { impulse: number | null; mood: string | null };

/** The purchases of [from, to) asked about or answered, `category`'s only when given, in `currency`. */
export async function impulseRows(from: number, to: number, currency: Currency, category?: number): Promise<ImpulseRow[]> {
  const db = await getDb();
  const rows = await db.all<Raw>(
    `SELECT s.id, s.category_id, s.kind, s.amount_minor, s.currency, s.occurred_at, s.refund_settled_at, s.merchant_key,
        s.raw_merchant, t.impulse, CASE WHEN t.impulse = 1 THEN t.mood END AS mood
      FROM spend_parts s JOIN transactions t ON t.id = s.id
      WHERE s.occurred_at >= ? AND s.occurred_at < ? AND s.kind IN (${sqlList(REMEMBERABLE_KINDS)})
        AND (t.impulse IS NOT NULL OR s.id IN (${UNANSWERED_SQL}))${category === undefined ? '' : ' AND s.category_id = ?'}`,
    category === undefined ? [from, to] : [from, to, category]);
  const { items } = await convertSpending(rows, currency);
  return items.map(({ row, value }) => {
    const r = row as Raw;
    return {
      tx: r.id, category: r.category_id, day: dateKey(r.occurred_at), value,
      impulse: r.impulse === null ? null : r.impulse === 1, mood: r.mood, merchantKey: r.merchant_key ?? null, merchant: r.raw_merchant ?? null,
    };
  });
}

/** Whether the category asks "Обдуманная" / "Импульсивная" ("Импульсивные покупки" on). */
export async function categoryAsksImpulse(id: number): Promise<boolean> {
  const db = await getDb();
  return !!(await db.get<{ v: number }>('SELECT impulse AS v FROM categories WHERE id = ?', [id]))?.v;
}
