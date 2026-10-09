// The operations' filters: what is set, what can be picked (with counts), the chips of the set ones, resets.
import { MutableRefObject, useCallback, useRef, useState } from 'react';
import {
  categoriesWithTransactions, CategoryFilter, CategoryWithCount, kindsWithTransactions, merchantsWithTransactions, MerchantWithCount,
} from '@/db/transactions';
import { DayRange, formatRange } from '@/shared/lib/dateRange';
import { KIND_LABELS } from '@/shared/lib/format';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { toast } from '@/shared/ui/toast';
import type { ActiveFilter } from '../FilterSheets';
import type { Filter } from './filter';

/**
 * `lockedRef`: the month of a category being sorted out — its category and this month are set and not shown as filters;
 * the dates stay within the month.
 */
export function useTransactionFilters(lockedRef: MutableRefObject<DayRange | null>) {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<CategoryFilter[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [range, setRange] = useState<DayRange | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryWithCount[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<MerchantWithCount[]>([]);
  const [kindOptions, setKindOptions] = useState<Array<{ kind: string; count: number }>>([]);
  const filter: Filter = { query, categories, merchants, kinds, range };
  // read by the list's reload without making it change (and re-run focus effects) on every keystroke
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const loadOptions = useCallback(() => {
    categoriesWithTransactions().then(setCategoryOptions).catch((e) => console.error('load category filter failed', e));
    merchantsWithTransactions().then(setMerchantOptions).catch((e) => console.error('load merchant filter failed', e));
    kindsWithTransactions().then(setKindOptions).catch((e) => console.error('load kind filter failed', e));
  }, []);

  /** Only these set, the rest cleared. */
  const setOnly = useCallback((f: Partial<Filter>) => {
    setQuery(f.query ?? ''); setCategories(f.categories ?? []); setMerchants(f.merchants ?? []);
    setKinds(f.kinds ?? []); setRange(f.range ?? null);
  }, []);
  const reset = useCallback(() => setOnly({}), [setOnly]);

  // the filters besides the locked ones of a sort-out (its category and month)
  function resetExtra() {
    const m = lockedRef.current;
    if (!m) { reset(); return; }
    setQuery(''); setMerchants([]); setKinds([]); setRange(m);
  }

  // the dates of a sort-out: this month or a part of it
  function changeRange(next: DayRange | null) {
    const m = lockedRef.current;
    if (!m) { setRange(next); return; }
    const clamp = (k: string) => (k < m.from ? m.from : k > m.to ? m.to : k);
    const r2 = next ? { from: clamp(next.from), to: clamp(next.to) } : m;
    if (next && (r2.from !== next.from || r2.to !== next.to)) toast('При удалении категории — только этот месяц');
    setRange(r2);
  }

  // the filters set, as chips to clear one by one
  const activeFilters = (lockedMonth: DayRange | null): ActiveFilter[] => {
    const active: ActiveFilter[] = [];
    for (const cat of lockedMonth ? [] : categories) {
      const c = categoryOptions.find((o) => o.category === cat);
      active.push({ key: `c${cat}`, label: c ? `${c.emoji || ''} ${c.name}`.trim() : cat === 'none' ? NO_CATEGORY : 'Категория', clear: () => setCategories((p) => p.filter((x) => x !== cat)) });
    }
    for (const k of kinds) {
      active.push({ key: `k${k}`, label: KIND_LABELS[k] ?? k, clear: () => setKinds((p) => p.filter((x) => x !== k)) });
    }
    for (const mer of merchants) {
      const m = merchantOptions.find((o) => o.merchant === mer);
      active.push({ key: `m${mer}`, label: m?.name ?? 'Мерчант', clear: () => setMerchants((p) => p.filter((x) => x !== mer)) });
    }
    if (range && !(lockedMonth && range.from === lockedMonth.from && range.to === lockedMonth.to)) {
      active.push({ key: 'date', label: formatRange(range), clear: () => changeRange(null) });
    }
    if (query.trim()) active.push({ key: 'text', label: `«${query.trim()}»`, clear: () => setQuery('') });
    return active;
  };

  return {
    filter, filterRef, query, setQuery, categories, setCategories, merchants, kinds, setKinds, range,
    categoryOptions, kindOptions, loadOptions, setOnly, reset, resetExtra, changeRange, activeFilters,
  };
}
