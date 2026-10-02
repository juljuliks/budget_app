import { createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Stats: undefined;
  /** open with a filter: text query or category ('none' = uncategorized); nonce re-applies the same one */
  Transactions: { query?: string; category?: number | 'none'; nonce?: number } | undefined;
};

/** Screens pushed over the tab bar. */
export type RootStackParamList = {
  Main: undefined;
  TransactionDetail: { txId: number };
  /**
   * No categoryId = create. After creating, the new category is: assigned to txId (with a merchant
   * rule) / to all txIds (bulk, no rules), added to the plan of planYm. typeId: preselected type.
   * returnSelection: hand the new id back to the previous screen as `selectCategoryId`.
   */
  CategoryEdit: { categoryId?: number; txId?: number; txIds?: number[]; planYm?: string; typeId?: number; returnSelection?: boolean };
  Categories: undefined;
  /** Delete a category, moving its current-month transactions to another one */
  CategoryDelete: { categoryId: number; selectCategoryId?: number };
  CategoryTypes: undefined;
  AddTransaction: { selectCategoryId?: number } | undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
