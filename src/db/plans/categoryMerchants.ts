// A category's merchants by what was spent at them: «Мерчанты» of its «Динамика» (this month, this year, all the time).
import type { Currency } from '../fx';
import { convertSpending, spendRows } from './spend';

export type CategoryMerchant = { key: string | null; name: string; value: number };

/**
 * The `count` merchants of a category spent at most from `from` (unix seconds; 0 — all the time) up to today, in
 * `currency` (each operation by its day's rate), refunds subtracted; operations without a merchant left out.
 */
export async function categoryMerchants(categoryId: number, currency: Currency, from: number, count = 5, now = new Date()): Promise<CategoryMerchant[]> {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000;
  const { items } = await convertSpending(await spendRows(from, to, { category: categoryId }), currency);
  const by = new Map<string, CategoryMerchant>();
  for (const { row, value } of items) {
    if (!row.raw_merchant) continue;
    const id = row.merchant_key ?? row.raw_merchant;
    const m = by.get(id) ?? { key: row.merchant_key ?? null, name: row.raw_merchant, value: 0 };
    m.value += value;
    by.set(id, m);
  }
  return [...by.values()].filter((m) => m.value > 0).sort((a, b) => b.value - a.value).slice(0, count);
}
