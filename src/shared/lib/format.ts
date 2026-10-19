import { formatMoneyWithCurrency } from './money';
import { MONTHS_GEN } from './dates';

const INCOME_KINDS = new Set(['deposit', 'refund']);

/** Transaction type as the bank SMS names it ("Deposit Money", "Payment", "Money Transfer", ...). */
export const KIND_LABELS: Record<string, string> = {
  purchase: 'Покупка',
  payment: 'Оплата',
  transfer: 'Перевод',
  deposit: 'Пополнение',
  refund: 'Возврат',
  withdrawal: 'Снятие наличных',
};

export function formatAmount(amountMinor: number, currency: string, kind?: string): string {
  const sign = kind && INCOME_KINDS.has(kind) ? '+' : '−';
  return `${sign}${formatMoneyWithCurrency(Math.abs(amountMinor), currency)}`;
}

export function isIncome(kind: string) {
  return INCOME_KINDS.has(kind);
}

export function dayKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}


// Hand-rolled: Hermes on RN 0.71 has limited Intl support
export function formatDay(unixSeconds: number, now = new Date()): string {
  const d = new Date(unixSeconds * 1000);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  const base = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Russian plural: plural(5, ['транзакция', 'транзакции', 'транзакций']) → 'транзакций'. */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

/** "12%", "<1%" for a tiny non-zero share. */
export function formatPercent(part: number, whole: number): string {
  const p = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return p === 0 && part > 0 ? '<1%' : `${p}%`;
}

/**
 * How often a repeating payment is charged (months > 0, weeks < 0, once 0): "каждую неделю", "раз в 2 недели", "каждый
 * месяц", "раз в 3 месяца", "раз в полгода", "раз в год", "раз в 2 года", "один раз".
 */
export function periodText(period: number): string {
  if (period === 0) return 'один раз';
  if (period === -1) return 'каждую неделю';
  if (period < 0) return `раз в ${-period} ${plural(-period, ['неделю', 'недели', 'недель'])}`;
  if (period === 1) return 'каждый месяц';
  if (period === 6) return 'раз в полгода';
  if (period === 12) return 'раз в год';
  if (period % 12 === 0) return `раз в ${period / 12} ${plural(period / 12, ['год', 'года', 'лет'])}`;
  return `раз в ${period} ${plural(period, ['месяц', 'месяца', 'месяцев'])}`;
}

/** A repeating payment's period chips: periods as periodText has them and their names (another — "Другое…"). */
export const PAYMENT_PERIODS: ReadonlyArray<readonly [number, string]> = [
  [-1, 'Каждую неделю'], [1, 'Каждый месяц'], [3, 'Раз в 3 месяца'], [6, 'Раз в полгода'], [12, 'Раз в год'], [0, 'Один раз'],
];
