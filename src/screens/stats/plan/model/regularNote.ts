// The note under a regular payment within the month in the plan: how often, the times by the amount, its end.
import type { PlanItem } from '@/db/plans';
import { timesInMonth } from '@/db/plans';
import { SHORT_MONTHS, WEEKDAYS } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';

/** "каждый день · 31 × 5 ₾", "пн, чт · 9 × 30 ₾ · до 15 дек"; null — not one. */
export function regularNote(item: Pick<PlanItem, 'every' | 'weekdays' | 'unit_minor' | 'until' | 'currency'>, ym: string): string | null {
  if (!item.every) return null;
  const days = item.every === 'day' ? 'каждый день'
    : [0, 1, 2, 3, 4, 5, 6].filter((i) => ((item.weekdays ?? 0) & (1 << i)) !== 0).map((i) => WEEKDAYS[(i + 1) % 7]).join(', ');
  const times = timesInMonth(ym, item.every, item.weekdays ?? 0, item.until);
  const end = item.until ? ` · до ${Number(item.until.slice(8))} ${SHORT_MONTHS[Number(item.until.slice(5, 7)) - 1]}` : '';
  return `${days} · ${times} × ${formatWithCurrency(item.unit_minor ?? 0, item.currency)}${end}`;
}
