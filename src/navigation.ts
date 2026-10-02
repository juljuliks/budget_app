import { createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  History: undefined;
  Stats: undefined;
  Planner: undefined;
};

/** Screens pushed over the tab bar. */
export type RootStackParamList = {
  Main: undefined;
  TransactionDetail: { txId: number };
  /** No categoryId = create. txId: assign the new category to this transaction right away. */
  CategoryEdit: { categoryId?: number; txId?: number };
  Categories: undefined;
  AddTransaction: undefined;
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
