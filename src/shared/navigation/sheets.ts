// The budget's things are pages (an operation, a merchant, a category: navigation.ts); the forms and steps are sheets
// over them, opened from anywhere — a page, a list row, a notification — with these functions. No UI here
// (notifications call them outside React): app/ModalHost (mounted once in App) shows the sheets. An open asked for
// before it is mounted (a notification on a cold start) waits for it.

export type SheetState = {
  /** a new operation by hand */
  addTransaction: boolean;
  /** the category sections (Хобби, Переводы, …) */
  categoryTypes: boolean;
  /** deleting a category that has operations this month: where they go */
  categoryDelete: number | null;
  /** a month's report ('YYYY-MM'): the notification on the 1st, «История», the stats of a past month */
  monthReport: string | null;
  /** "Итоги месяца" of a month over ('YYYY-MM'): the notification on the 1st, the banner, «История» */
  monthClose: string | null;
  /** "Резервная копия" (from the settings page): save, restore, CSV, the automatic copy, the password */
  backup: boolean;
  /** "Блокировка" (Настройки → "Настроить"): the fingerprint, when to ask, the notifications, a new PIN */
  lockOptions: boolean;
  /** a repeating payment: one (`id`), or the one of an operation's merchant (`txId`: made from it if it has none) */
  payment: PaymentOpen | null;
};

export type PaymentOpen = {
  id?: number;
  txId?: number;
  /** an operation picked for this category's payment ("Выбрать операцию"): the payment is the category's */
  categoryId?: number;
  /** after it is saved (not on "Отмена") */
  onSaved?: () => void;
};

export const CLOSED: SheetState = { addTransaction: false, categoryTypes: false, categoryDelete: null, monthReport: null, monthClose: null, backup: false, lockOptions: false, payment: null };

let handler: ((patch: Partial<SheetState>) => void) | null = null;
let pending: Partial<SheetState> = {};

function open(patch: Partial<SheetState>) {
  if (handler) handler(patch); else pending = { ...pending, ...patch };
}

export const openAddTransaction = () => open({ addTransaction: true });
export const openCategoryTypes = () => open({ categoryTypes: true });
export const openCategoryDelete = (categoryId: number) => open({ categoryDelete: categoryId });
export const openMonthReport = (ym: string) => open({ monthReport: ym });
export const openMonthClose = (ym: string) => open({ monthClose: ym });
export const openBackup = () => open({ backup: true });
export const openLockOptions = () => open({ lockOptions: true });
export const openPayment = (which: PaymentOpen) => open({ payment: which });

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
