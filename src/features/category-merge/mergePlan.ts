// The merged category's plan this month: the amounts summed, and the ways the picked ones are planned.
import type { Category } from '@/db/categories';
import { mergePlanPreview, type MergeRhythm } from '@/db/mergeCategories';
import type { planConverter } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';

export const rhythmKey = (r: MergeRhythm) => `${r.kind}:${r.norm}:${r.every ?? ''}:${r.weekdays ?? ''}`;

/** The sum in the target's plan currency (else the first item's), as the merge stores it; the ways, each with whose. */
export function mergePlan(
  ids: number[],
  picked: Category[],
  items: Awaited<ReturnType<typeof mergePlanPreview>>,
  conv: Awaited<ReturnType<typeof planConverter>>,
): { sum: string | null; ways: Array<{ rhythm: MergeRhythm; names: string[] }> } {
  // the sum in the target's plan currency (else the first item's), as the merge stores it
  let sumText: string | null = null;
  const own = items.find((i) => i.category_id === ids[0]) ?? items[0];
  if (own) {
    const sum = items.reduce(
      (a, i) =>
        a +
        (i.currency === own.currency
          ? i.limit_minor
          : (conv(i.limit_minor, i.currency, own.currency) ?? i.limit_minor)),
      0,
    );
    sumText = formatWithCurrency(Math.round(sum), own.currency);
  }
  const ways: Array<{ rhythm: MergeRhythm; names: string[] }> = [];
  for (const id of ids) {
    const i = items.find((x) => x.category_id === id);
    if (!i) continue;
    const r: MergeRhythm = {
      kind: i.kind,
      norm: i.kind === 'fixed' ? 'month' : i.norm_period,
      every: i.every,
      weekdays: i.every === 'week' ? i.weekdays : null,
    };
    const c = picked.find((x) => x.id === id);
    const way = ways.find((w) => rhythmKey(w.rhythm) === rhythmKey(r));
    if (way) way.names.push(c?.name ?? '');
    else ways.push({ rhythm: r, names: [c?.name ?? ''] });
  }
  return { sum: sumText, ways };
}
