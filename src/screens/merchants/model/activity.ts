// What a merchant's row says about its purchases.
import type { MerchantActivity } from '@/db/merchants';
import { SHORT_MONTHS } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';

/** "12 мая", with the year when it isn't this one: "12 мая 2025". */
export function shortDate(unix: number, now = new Date()): string {
  const d = new Date(unix * 1000);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

/**
 * "За последний месяц: 3 покупки на 45.20 ₾", or without any then, all of them with their dates:
 * "5 покупок на 120 ₾ · 12 мая – 20 авг".
 */
export function activityText(a: MerchantActivity, now = new Date()): string {
  if (a.count === 0) return 'Покупок нет';
  const what = `${a.count} ${plural(a.count, ['покупка', 'покупки', 'покупок'])} на ${a.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ')}`;
  if (a.recent) return `За последний месяц: ${what}`;
  const from = shortDate(a.from, now), to = shortDate(a.to, now);
  return `${what} · ${from === to ? from : `${from} – ${to}`}`;
}
