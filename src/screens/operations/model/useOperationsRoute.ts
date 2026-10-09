// How the tab was opened (from the stats, a merchant's card, a category's sheet, a sort-out) and the way back there.
import { useEffect } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { Filter } from '@/features/operations-filters';
import { TabParamList, useRootNavigation } from '@/shared/navigation/navigation';

export type TabNavigation = BottomTabNavigationProp<TabParamList, 'Transactions'>;

export function useOperationsRoute(resetFilters: () => void) {
  const navigation = useRootNavigation();
  const tabNavigation = useNavigation<TabNavigation>();
  const route = useRoute<RouteProp<TabParamList, 'Transactions'>>();
  const params = route.params ?? {};
  const { from } = params;

  function clearParams() {
    tabNavigation.setParams({ from: undefined, category: undefined, query: undefined, range: undefined, kinds: undefined, sortOut: undefined });
    resetFilters();
  }

  // came here from another screen (not the tab bar): back returns there with the filter cleared
  function goBack() {
    const target = from;
    clearParams();
    if (target === 'Merchants' || target === 'Categories') navigation.navigate(target);
    else if (target) tabNavigation.navigate(target);
  }

  return { params, from, tabNavigation, clearParams, goBack };
}

/** Opened with a filter (the stats: a category; a merchant's card: its name): only what was asked for is shown. */
export function useIncomingFilters(
  { category, query, range, kinds, nonce }: { category?: number | 'none'; query?: string; range?: Filter['range']; kinds?: string[]; nonce?: number },
  setOnly: (f: Partial<Filter>) => void,
  dropSortOut: () => void,
) {
  useEffect(() => {
    if (category === undefined) return;
    dropSortOut(); // another way in ends a sort-out left going on
    setOnly({ categories: [category], range: range ?? null, kinds: kinds ?? [] });
  }, [category, range, kinds, nonce, setOnly, dropSortOut]);
  // its name in the search field, as if typed
  useEffect(() => {
    if (query === undefined) return;
    dropSortOut(); // another way in ends a sort-out left going on
    setOnly({ query });
  }, [query, nonce, setOnly, dropSortOut]);
}
