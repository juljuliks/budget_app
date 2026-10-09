import { createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { DayRange } from '../lib/dateRange';

export type TabParamList = {
  /** day: open the stats of that day (a day header in the transactions list), its local midnight in unix seconds */
  Stats: { day?: number; nonce?: number } | undefined;
  /**
   * open filtered by a category ('none' = uncategorized), within a range (the stats month); nonce re-applies the same one.
   * from: the tab we came from (not via the tab bar) -> a back button in the header returns there.
   */
  Transactions: {
    category?: number | 'none'; range?: DayRange; kinds?: string[];
    /** typed into the search field (a merchant's name from its card) */
    query?: string;
    nonce?: number;
    /** a category being deleted: its operations of this month to sort out to other categories, then it goes */
    sortOut?: number;
    /** where back returns: a tab, or the merchants / categories screen */
    from?: keyof TabParamList | 'Merchants' | 'Categories';
  } | undefined;
};

/** Screens pushed over the tab bar. */
export type RootStackParamList = {
  Main: undefined;
  Categories: undefined;
  /** Merchants with their categories; merging into groups */
  Merchants: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

/**
 * From the stats tab: the Transactions tab filtered by a category (null = uncategorized) and the period looked at
 * (the month of the stats / history row), with a back button.
 */
export function useOpenCategoryTransactions() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  return (categoryId: number | null, range?: DayRange, kinds?: string[]) =>
    navigation.navigate('Transactions', { category: categoryId ?? 'none', range, kinds, nonce: Date.now(), from: 'Stats' });
}

type Route = { [K in keyof RootStackParamList]: { name: K; params: RootStackParamList[K] } }[keyof RootStackParamList];

// A notification action may ask to open a screen before the navigator is mounted
// (cold start, or the press was delivered to the background handler). Keep it until it can run.
let pending: Route | null = null;

export function navigateWhenReady(route: Route) {
  if (navigationRef.isReady()) {
    // `as never`: TS can't narrow the name/params union against navigate's overloads
    navigationRef.navigate(route as never);
  } else {
    pending = route;
  }
}

/** Called from NavigationContainer.onReady and when the app returns to the foreground. */
export function flushPendingNavigation() {
  if (!pending || !navigationRef.isReady()) return;
  const route = pending;
  pending = null;
  navigateWhenReady(route);
}
