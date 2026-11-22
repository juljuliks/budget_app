// «Итоги года»: what a year's spending says — where it went, what is remembered (the biggest purchase, the subscriptions,
// the most frequent merchant, the days without spending). Pure: from the year's rows, converted. No React, no database.

/** A spending row of the year, converted to the report's currency (`value`; a refund — negative). */
export type YearRow = {
  value: number; own: number; currency: string; category_id: number | null; kind: string; occurred_at: number;
  merchant_key: string | null; raw_merchant: string | null;
};
/** A category's plan in a month (its limit, converted), for «перерасход в N из M месяцев». */
export type MonthLimit = { ym: string; category_id: number; limit: number };

const ymOfTs = (ts: number) => { const d = new Date(ts * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const dayOfTs = (ts: number) => { const d = new Date(ts * 1000); return `${ymOfTs(ts)}-${String(d.getDate()).padStart(2, '0')}`; };
/** a planned category's overspend under this share of its plan is noise (as the month's report) */
const OVER_TOLERANCE = 0.05;
const PURCHASES = new Set(['purchase', 'payment']);

export type TopCategory = { id: number; sum: number; perMonth: number; overIn: number; planned: number };

/** The biggest categories of the year (`skip` — the funds', the transfers'), each with how often it went past its plan. */
export function topCategories(rows: YearRow[], limits: MonthLimit[], months: number, skip: Set<number>, n = 5): TopCategory[] {
  const sums = new Map<number, number>();
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    if (r.category_id === null || skip.has(r.category_id)) continue;
    sums.set(r.category_id, (sums.get(r.category_id) ?? 0) + r.value);
    const k = `${ymOfTs(r.occurred_at)}|${r.category_id}`;
    byMonth.set(k, (byMonth.get(k) ?? 0) + r.value);
  }
  return [...sums].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, sum]) => {
    const own = limits.filter((l) => l.category_id === id && l.limit > 0);
    return {
      id, sum, perMonth: months > 0 ? Math.round(sum / months) : sum,
      overIn: own.filter((l) => (byMonth.get(`${l.ym}|${id}`) ?? 0) > l.limit * (1 + OVER_TOLERANCE)).length, planned: own.length,
    };
  });
}

/** The biggest single purchase. */
export function biggestPurchase(rows: YearRow[]): YearRow | null {
  return rows.filter((r) => PURCHASES.has(r.kind)).reduce<YearRow | null>((m, r) => (!m || r.value > m.value ? r : m), null);
}

export type Subscriptions = { count: number; total: number; perMonth: number; raised: Array<{ merchant: string; by: number; currency: string }> };

/** «📺 Подписки» of the year: how many merchants, how much, which one costs more at the end than at the start. */
export function subscriptions(rows: YearRow[], subsId: number | null, months: number): Subscriptions | null {
  const own = rows.filter((r) => r.category_id === subsId && subsId !== null && PURCHASES.has(r.kind) && r.merchant_key)
    .sort((a, b) => a.occurred_at - b.occurred_at);
  if (!own.length) return null;
  const by = new Map<string, YearRow[]>();
  for (const r of own) by.set(r.merchant_key!, [...by.get(r.merchant_key!) ?? [], r]);
  const raised = [...by.values()].filter((list) => list.length > 1 && list[list.length - 1].own > list[0].own && list[0].currency === list[list.length - 1].currency)
    .map((list) => ({ merchant: list[0].raw_merchant ?? list[0].merchant_key!, by: list[list.length - 1].own - list[0].own, currency: list[0].currency }));
  const total = own.reduce((a, r) => a + r.value, 0);
  return { count: by.size, total, perMonth: months > 0 ? Math.round(total / months) : total, raised };
}

export type Frequent = { merchant: string; count: number; total: number; average: number };

/** The merchant bought from most often. */
export function frequentMerchant(rows: YearRow[]): Frequent | null {
  const by = new Map<string, { name: string; count: number; total: number }>();
  for (const r of rows) {
    if (!PURCHASES.has(r.kind) || !r.merchant_key) continue;
    const m = by.get(r.merchant_key) ?? { name: r.raw_merchant ?? r.merchant_key, count: 0, total: 0 };
    m.count += 1; m.total += r.value;
    by.set(r.merchant_key, m);
  }
  const top = [...by.values()].sort((a, b) => b.count - a.count || b.total - a.total)[0];
  return top && top.count > 1 ? { merchant: top.name, count: top.count, total: top.total, average: Math.round(top.total / top.count) } : null;
}

export type NoSpendDays = { days: number; of: number; best: { ym: string; days: number } | null };

/**
 * Days without everyday spending (a purchase; the regular payments — `regular` categories — aside) from `from` to `to`
 * (day keys, both in).
 */
export function noSpendDays(rows: YearRow[], regular: Set<number>, from: string, to: string): NoSpendDays {
  const spent = new Set(rows.filter((r) => PURCHASES.has(r.kind) && !(r.category_id !== null && regular.has(r.category_id))).map((r) => dayOfTs(r.occurred_at)));
  const byMonth = new Map<string, number>();
  let days = 0;
  let of = 0;
  for (const d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 1)) {
    const key = dayOfTs(d.getTime() / 1000);
    of += 1;
    if (spent.has(key)) continue;
    days += 1;
    byMonth.set(key.slice(0, 7), (byMonth.get(key.slice(0, 7)) ?? 0) + 1);
  }
  const best = [...byMonth].sort((a, b) => b[1] - a[1])[0];
  return { days, of, best: best ? { ym: best[0], days: best[1] } : null };
}
