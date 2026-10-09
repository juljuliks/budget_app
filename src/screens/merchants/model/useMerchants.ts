// The merchants by their category, searched and filtered; the long-unvisited ones collapsed at the bottom.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel, listCategories } from '@/db/categories';
import { categoryColors } from '@/db/colors';
import { listMerchants, MerchantRow } from '@/db/merchants';
import { normalizeForSearch } from '@/db/transactions';
import { onTransactionsChanged } from '@/events';
import type { CategoryInfo } from '@/entities/category';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';

/** Merchants of different categories (a delivery): each operation asks. */
export const MIXED = 'Разные категории';

export type CategoryKey = number | 'none' | 'mixed';
/** `count`: the section's merchants (a collapsed one shows none of them); `stale`: the "давно не было покупок" one */
export type Section = { key: string; title: string; count: number; stale?: boolean; data: MerchantRow[] };

export function useMerchants() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [categories, setCategories] = useState<Map<number, CategoryInfo>>(new Map());
  // the categories' order (as on the categories screen)
  const [order, setOrder] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  // the categories filter, as on the operations ('none' = without a category)
  const [catFilter, setCatFilter] = useState<CategoryKey[]>([]);
  const [staleOpen, setStaleOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([listMerchants(), listCategories(), categoryColors()]).then(([m, cats, colorOf]) => {
      setMerchants(m);
      setOrder(cats.map((c) => c.id));
      setCategories(new Map(cats.map((c) => [c.id, { label: categoryLabel(c), color: colorOf.get(c.id) ?? colors.border }])));
    }).catch((e) => console.error('load merchants failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const words = normalizeForSearch(query);
  // a merchant whose category is gone counts as without one; of different categories: a group of its own
  const catOf = useCallback((m: MerchantRow): CategoryKey => (m.mixed ? 'mixed'
    : m.category_id !== null && categories.has(m.category_id) ? m.category_id : 'none'), [categories]);
  const shown = useMemo(() => merchants.filter((m) => (!words || normalizeForSearch(m.name).includes(words))
    && (catFilter.length === 0 || catFilter.includes(catOf(m)))), [merchants, words, catFilter, catOf]);
  // a search or a filter shows the long-unvisited ones too, in their categories
  const filtering = !!words || catFilter.length > 0;
  // the filter's options: "Без категории" first, then the categories in their order, each with its merchants
  const catOptions = useMemo(() => {
    const count = new Map<CategoryKey, number>();
    for (const m of merchants) count.set(catOf(m), (count.get(catOf(m)) ?? 0) + 1);
    return (['none', 'mixed', ...order] as CategoryKey[]).filter((c) => count.has(c))
      .map((c) => ({ key: c, label: c === 'none' ? NO_CATEGORY : c === 'mixed' ? MIXED : categories.get(c)!.label, count: count.get(c)! }));
  }, [merchants, order, categories, catOf]);

  // one section per category with merchants bought at in the last month (RECENT_DAYS). The others (a shop visited once
  // long ago) wait collapsed at the bottom: nothing is deleted, a search shows them all in their categories, and a new
  // purchase brings one back
  const sections = useMemo<Section[]>(() => {
    const by = new Map<number | null | 'mixed', MerchantRow[]>();
    const stale: MerchantRow[] = [];
    for (const m of shown) {
      if (!filtering && !m.activity.recent) { stale.push(m); continue; }
      const c = m.mixed ? 'mixed' : m.category_id !== null && categories.has(m.category_id) ? m.category_id : null;
      by.set(c, [...(by.get(c) ?? []), m]);
    }
    const out: Section[] = ([null, 'mixed', ...order] as Array<number | null | 'mixed'>).filter((c) => by.has(c)).map((c) => ({
      key: String(c),
      title: c === null ? NO_CATEGORY : c === 'mixed' ? MIXED : categories.get(c)!.label,
      count: by.get(c)!.length,
      data: by.get(c)!,
    }));
    if (stale.length) out.push({ key: 'stale', title: 'Давно не было покупок', count: stale.length, stale: true, data: staleOpen ? stale : [] });
    return out;
  }, [shown, filtering, categories, order, staleOpen]);

  return { merchants, categories, query, setQuery, catFilter, setCatFilter, catOptions, filtering, sections, staleOpen, setStaleOpen };
}
