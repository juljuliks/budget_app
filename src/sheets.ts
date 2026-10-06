// The app has four pages (Операции, Статистика, Мерчанты, Категории); everything else is a sheet over them, opened
// from anywhere — a list row, the settings, a notification — with these functions. No UI here (notifications
// call them outside React): ui/modals.tsx (ModalHost, mounted once in App) shows the sheets. An open asked for
// before it is mounted (a notification on a cold start) waits for it.

export type SheetState = {
  /** an operation: its amount, category, SMS, note; settles a refund, deletes it */
  transaction: number | null;
  /** a new operation by hand */
  addTransaction: boolean;
  /** the category sections (Хобби, Переводы, …) */
  categoryTypes: boolean;
  /** deleting a category that has operations this month: where they go */
  categoryDelete: number | null;
  /** a month's report ('YYYY-MM'): the notification on the 1st, «История», the stats of a past month */
  monthReport: string | null;
};

export const CLOSED: SheetState = { transaction: null, addTransaction: false, categoryTypes: false, categoryDelete: null, monthReport: null };

let handler: ((patch: Partial<SheetState>) => void) | null = null;
let pending: Partial<SheetState> = {};

function open(patch: Partial<SheetState>) {
  if (handler) handler(patch); else pending = { ...pending, ...patch };
}

export const openTransaction = (txId: number) => open({ transaction: txId });
export const openAddTransaction = () => open({ addTransaction: true });
export const openCategoryTypes = () => open({ categoryTypes: true });
export const openCategoryDelete = (categoryId: number) => open({ categoryDelete: categoryId });
export const openMonthReport = (ym: string) => open({ monthReport: ym });

/** ModalHost registers itself; returns what was asked for before it was mounted. */
export function attachSheetHost(h: (patch: Partial<SheetState>) => void): Partial<SheetState> {
  handler = h;
  const p = pending;
  pending = {};
  return p;
}

export function detachSheetHost() {
  handler = null;
}
