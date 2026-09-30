import { createNavigationContainerRef } from '@react-navigation/native';

export type RootStackParamList = {
  Transactions: undefined;
  TransactionDetail: { txId: number };
  /** txId: assign the new category to this transaction right away */
  CreateCategory: { txId?: number };
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
