// ⓘ by a rebalanced limit ("· лимит 94.50 ₾ в неделю ⓘ"): why it isn't the plan's even share — what was spent in the
// month before this window and what is left for the days left.
import type { Currency } from '@/db/fx';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { PER_PERIOD } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import type { CategoryNorm } from '@/stats/norms';

type Rhythm = 'day' | 'week' | '2weeks';
const BEFORE = { day: 'До сегодня', week: 'До этой недели', '2weeks': 'До этих 2 недель' } as const;

/** The limit's window in this month: its share of the plan, what was spent before it, the days left. */
export function limitWhyText(rhythm: Rhythm, now: CategoryNorm, ym: string, flat: number, value: number, scale: number, currency: Currency): string {
  const money = (minor: number) => formatWithCurrency(Math.round(minor), currency);
  const part = now.windowParts.find((p) => p.ym === ym) ?? now.windowParts[0];
  const per = PER_PERIOD[rhythm];
  const lines = [`По плану — ${money(flat)} ${per}: ${money(part.limit * scale)} на ${part.dim} ${plural(part.dim, ['день', 'дня', 'дней'])}.`];
  lines.push(`${BEFORE[rhythm]} потрачено ${money(part.spentBefore * scale)}, осталось ${money(Math.max(0, part.limit - part.spentBefore) * scale)} `
    + `на ${part.daysLeft} ${plural(part.daysLeft, ['день', 'дня', 'дней'])} — это ${money(value)} ${per}.`);
  lines.push(value < flat
    ? 'Раньше в этом месяце тратили больше плана — лимит меньше, чтобы месяц уложился в план.'
    : 'Раньше в этом месяце тратили меньше плана — лимит больше.');
  return lines.join('\n\n');
}

export function explainLimit(...args: Parameters<typeof limitWhyText>) {
  sheetAlert('Почему лимит изменился', limitWhyText(...args));
}
