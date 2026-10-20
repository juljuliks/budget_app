// The note under a regular payment within the month in the plan: how often, the times by the amount, its end.
import type { PlanItem } from '@/db/plans';
import { regularDays, timesInMonth } from '@/db/plans';
import { SHORT_MONTHS, WEEKDAYS } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';

const shortOf = (day: string) => `${Number(day.slice(8))} ${SHORT_MONTHS[Number(day.slice(5, 7)) - 1]}`;

/**
 * "каждый день · 31 × 5 ₾", "вт · 4 × 150 ₾ · 21 окт · до 15 дек" — the plan, not what was paid (that is the stats'):
 * the next of its days by the calendar, from `today` (the current month only).
 */
export function regularNote(item: Pick<PlanItem, 'every' | 'weekdays' | 'unit_minor' | 'until' | 'currency'>, ym: string, today: string): string | null {
  if (!item.every) return null;
  const days = item.every === 'day' ? 'каждый день'
    : [0, 1, 2, 3, 4, 5, 6].filter((i) => ((item.weekdays ?? 0) & (1 << i)) !== 0).map((i) => WEEKDAYS[(i + 1) % 7]).join(', ');
  const times = timesInMonth(ym, item.every, item.weekdays ?? 0, item.until);
  const end = item.until ? ` · до ${shortOf(item.until)}` : '';
  const next = item.every === 'week' && today.slice(0, 7) === ym ? regularDays(ym, 'week', item.weekdays ?? 0, item.until).find((d) => d >= today) : undefined;
  return `${days} · ${times} × ${formatWithCurrency(item.unit_minor ?? 0, item.currency)}${next ? ` · ${shortOf(next)}` : ''}${end}`;
}
