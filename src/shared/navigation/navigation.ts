import { createNavigationContainerRef, NavigationState, StackActions, useNavigation } from '@react-navigation/native';
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
    /** a category's repeating payment being made: a tap on an operation makes it from it (its label in the banner) */
    pickPayment?: { id: number; label: string };
    /** where back returns: a tab, or a page over them (the merchants, the categories) */
    from?: BackTarget;
  } | undefined;
};

/** Where the operations opened from somewhere else return: a tab, a page over them, or `'pages'` — the pages a link left (showOperationsFrom). */
export type BackTarget = keyof TabParamList | 'Merchants' | 'Categories' | 'Settings' | 'Banks' | 'Unparsed' | 'MessageTemplates' | 'pages';

/** Screens pushed over the tab bar. */
export type RootStackParamList = {
  Main: undefined;
  /** the settings (the gear in the tab headers) */
  Settings: undefined;
  Categories: undefined;
  /** Merchants with their categories; merging into groups */
  Merchants: undefined;
  /** bank messages no operation came from ("Не распознано") */
  Unparsed: undefined;
  /** one of them, marked */
  UnparsedMessage: { id: number };
  /** the user's templates for them ("Шаблоны сообщений", from the settings) */
  MessageTemplates: undefined;
  /** whose SMS and pushes are read ("Банки", from the settings) */
  Banks: undefined;
  /** an operation: its amount, category, SMS, note (a list's row, a notification, the merchant's and category's pages) */
  Operation: { id: number };
  /** a merchant: its operations, category, "Разные категории" (its key) */
  Merchant: { key: string };
  /** a category: its operations, section, name, color */
  Category: { id: number };
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
let pending: { route: Route; push: boolean } | null = null;

/** `push`: a page over the current one even if one like it is open (an operation from a merchant from an operation). */
export function navigateWhenReady(route: Route, push = false) {
  if (!navigationRef.isReady()) { pending = { route, push }; return; }
  if (push) navigationRef.dispatch(StackActions.push(route.name, route.params));
  // `as never`: TS can't narrow the name/params union against navigate's overloads
  else navigationRef.navigate(route as never);
}

/** Called from NavigationContainer.onReady and when the app returns to the foreground. */
export function flushPendingNavigation() {
  if (!pending || !navigationRef.isReady()) return;
  const { route, push } = pending;
  pending = null;
  navigateWhenReady(route, push);
}

// The budget's things are pages over the tabs, each over the one it was opened from; back walks the chain.
export const openTransaction = (id: number) => navigateWhenReady({ name: 'Operation', params: { id } }, true);
export const openMerchant = (key: string) => navigateWhenReady({ name: 'Merchant', params: { key } }, true);
export const openCategory = (id: number) => navigateWhenReady({ name: 'Category', params: { id } }, true);

// the pages "Показать все ›" took the user away from, the latest last: back from the operations restores them
const left: NavigationState[] = [];

/**
 * "Показать все ›" / "N операций ›" of a merchant's or a category's page: the operations tab with its filter; back
 * from there (backToPages) puts the pages back as they were (the operation it was opened from under it too).
 */
export function showOperationsFrom(filter: { category?: number; query?: string; range?: DayRange; pickPayment?: { id: number; label: string } }) {
  left.push(navigationRef.getRootState());
  // `as never`: a nested navigate the root types don't describe
  navigationRef.navigate('Main', { screen: 'Transactions', params: { ...filter, nonce: Date.now(), from: 'pages' } } as never);
}

/**
 * "Выбрать операцию" of a category's repeating payment: its operations of the month (the filters can be changed); a tap
 * on one makes the payment from it, and back — or the payment saved — puts the screen as it was.
 */
export const pickPaymentOperation = (category: { id: number; label: string }, range: DayRange) =>
  showOperationsFrom({ category: category.id, range, pickPayment: category });

/** Back from the operations a page's link opened: those pages again; false — there were none. */
export function backToPages(): boolean {
  const s = left.pop();
  if (!s) return false;
  navigationRef.reset(s);
  return true;
}

/** The operations left another way (their tab pressed): the pages are not coming back. */
export function forgetPages() {
  left.length = 0;
}
