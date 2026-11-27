// A category's kinds and labels: no database here.
export type Category = {
  id: number;
  name: string;
  emoji: string | null;
  sort_order: number;
  type_id: number | null;
  type_name: string | null;
  /** 1 when the category's type is the transfer type: offered for money transfers (see isTransferCategory) */
  type_is_transfer: number;
  deleted_at: number | null;
  /** own color; null = from the type's palette (see src/domain/colors.ts) */
  color: string | null;
  /** 'topup' for "Пополнение счёта", 'own', 'subs' for "Подписки" (system categories: can't be deleted or renamed), else null */
  system: string | null;
  /** 1 — "Регулярные платежи": its plan item counted from its payments (db/recurring) */
  recurring: number;
  /** 1 — "Подписки" (system = 'subs', read from it; the column itself is left over): a subscription of each merchant */
  by_merchant: number;
  /** 1 — "Импульсивные покупки" (on its page): its operations ask whether the purchase was impulsive (db/impulse.ts) */
  impulse: number;
  /** its kind in the plan ("В плане" on its page; db/plans/categoryKind.ts); null — not set */
  plan_kind: 'limit' | 'regular' | 'oneoff' | 'fund' | null;
};

/**
 * The system category every deposit goes to by default: money that came to the card (P2P from crypto, a salary) —
 * what the month has to distribute, not spending. Deposits only; one, can't be deleted (src/db/plans.ts monthIncome).
 */
const TOP_UP = 'topup';
export const isTopUp = (c: { system?: string | null }) => c.system === TOP_UP;

/** "Между своими картами": money between one's own cards and accounts (other banks, a savings one) — not spending, not income. */
export const OWN_TRANSFER = 'own';
/** A category of the system: "Пополнение счёта", "Между своими картами", "Подписки" (not renamed, deleted or merged). */
export const isSystemCategory = (c: { system?: string | null }) => !!c.system;
/**
 * "📺 Подписки": the one category of subscriptions (its merchants', each followed by its charges); no fund, no
 * "Импульсивные покупки" — planned payments. Planned like any other.
 */
export const SUBSCRIPTIONS = 'subs';
export const isSubscriptions = (c: { system?: string | null }) => c.system === SUBSCRIPTIONS;

export function isTransferCategory(c: Pick<Category, 'type_is_transfer'>): boolean {
  return c.type_is_transfer === 1;
}

/** "💸 Маме": the category alone, without its section (the notifications' buttons are short) */
export function categoryShortLabel(c: { emoji?: string | null; name: string }): string {
  return `${c.emoji || ''} ${c.name}`.trim();
}

/** "💸 Переводы: Маме" */
export function categoryLabel(c: { emoji?: string | null; name: string; type_name?: string | null }): string {
  return `${c.emoji || ''} ${c.type_name ? `${c.type_name}: ` : ''}${c.name}`.trim();
}

/** Category label of a transaction row (its joined category_* columns); null when uncategorized. */
export function txCategoryLabel(tx: {
  category_id: number | null;
  category_name: string | null;
  category_emoji: string | null;
  category_type_name: string | null;
}): string | null {
  if (tx.category_id === null || tx.category_name === null) return null;
  return categoryLabel({ emoji: tx.category_emoji, name: tx.category_name, type_name: tx.category_type_name });
}
