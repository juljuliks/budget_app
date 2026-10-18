// The app has a few pages (Операции, Статистика, Мерчанты, Категории, Настройки…); everything else is a sheet over them,
// opened from anywhere — a list row, a link in another sheet, a notification — with these functions. No UI here
// (notifications call them outside React): app/ModalHost (mounted once in App) shows the sheets. An open asked for
// before it is mounted (a notification on a cold start) waits for it. A link from a sheet to a page hides the sheets
// and back from the page shows them again (leaveSheets / backToSheets), as a browser's history.

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
  /** "Итоги месяца" of a month over ('YYYY-MM'): the notification on the 1st, the banner, «История» */
  monthClose: string | null;
  /** a merchant's card (its key), over the operation it was opened from */
  merchant: string | null;
  /** "Резервная копия" (from the settings page): save, restore, CSV, the automatic copy, the password */
  backup: boolean;
  /** "Блокировка" (Настройки → "Настроить"): the fingerprint, when to ask, the notifications, a new PIN */
  lockOptions: boolean;
  /** a repeating payment: one (`id`), or the one of an operation's merchant (`txId`: made from it if it has none) */
  payment: { id?: number; txId?: number } | null;
  /** a category's own sheet (its name, section, color, repeating payments): from the plan's sheet, over it */
  category: number | null;
};

export const CLOSED: SheetState = { transaction: null, addTransaction: false, categoryTypes: false, categoryDelete: null, monthReport: null, monthClose: null, merchant: null, backup: false, lockOptions: false, payment: null, category: null };

/** ModalHost: opens / closes sheets; `take` closes them all and says what was open. */
type Host = { patch: (patch: Partial<SheetState>) => void; take: () => SheetState };

let handler: Host | null = null;
let pending: Partial<SheetState> = {};
// sheets a link took the user away from to a page, the latest last: back from the page shows them again
const left: SheetState[] = [];

function open(patch: Partial<SheetState>) {
  if (handler) handler.patch(patch); else pending = { ...pending, ...patch };
}

/** A link from a sheet to a page ("Показать операции"): the open sheets hide, `backToSheets` shows them again. */
export function leaveSheets() {
  if (handler) left.push(handler.take());
}

/** Back from the page a link of a sheet opened: those sheets again; false — there were none. */
export function backToSheets(): boolean {
  const s = left.pop();
  if (!s) return false;
  open(s);
  return true;
}

/** The page left another way (its tab pressed): the sheets it was opened from are not coming back. */
export function forgetSheets() {
  left.length = 0;
}

export const openTransaction = (txId: number) => open({ transaction: txId });
export const openAddTransaction = () => open({ addTransaction: true });
export const openCategoryTypes = () => open({ categoryTypes: true });
export const openCategoryDelete = (categoryId: number) => open({ categoryDelete: categoryId });
export const openMonthReport = (ym: string) => open({ monthReport: ym });
export const openMonthClose = (ym: string) => open({ monthClose: ym });
export const openMerchant = (merchantKey: string) => open({ merchant: merchantKey });
export const openBackup = () => open({ backup: true });
export const openLockOptions = () => open({ lockOptions: true });
export const openPayment = (which: { id?: number; txId?: number }) => open({ payment: which });
export const openCategory = (categoryId: number) => open({ category: categoryId });

/** ModalHost registers itself; returns what was asked for before it was mounted. */
export function attachSheetHost(h: Host): Partial<SheetState> {
  handler = h;
  const p = pending;
  pending = {};
  return p;
}

export function detachSheetHost() {
  handler = null;
}
