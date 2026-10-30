// How each plan row is going ("насколько выполнен"): a short line under it — the current month's and a past one's; a
// coming month has none. "Скрыть суммы": the words alone. No React.
import { formatPercent } from '@/shared/lib/format';

export type Timing = 'past' | 'current' | 'future';
export type Mark = { text: string; tone: 'ok' | 'warn' | 'muted' };
type Money = (minor: number) => string;

/**
 * A category's row: a limit — what was spent ("потрачено 320 ₾"; a past month within it — "✓ уложились"); a payment
 * (one-off, regular) — paid or not ("✓ оплачено", "не оплачено"); past its plan — "больше на 50 ₾". Nothing planned
 * and nothing spent: none.
 */
export function itemMark(kind: 'limit' | 'payment', plan: number, spent: number, timing: Timing, money: Money, hidden: boolean): Mark | null {
  if (timing === 'future' || (plan <= 0 && spent <= 0)) return null;
  const over = spent - plan;
  if (over > 0) {
    if (hidden) return { text: 'больше плана', tone: 'warn' };
    return { text: kind === 'payment' && plan > 0 ? `оплачено ${money(spent)} · больше на ${money(over)}` : `больше на ${money(over)}`, tone: 'warn' };
  }
  if (kind === 'payment') {
    if (spent >= plan) return { text: '✓ оплачено', tone: 'ok' };
    if (spent > 0) return { text: hidden ? 'оплачено частично' : `оплачено ${money(spent)} из ${money(plan)}`, tone: 'muted' };
    return { text: 'не оплачено', tone: 'muted' };
  }
  if (timing === 'past') return { text: '✓ уложились', tone: 'ok' };
  return { text: hidden ? `потрачено ${formatPercent(spent, plan)}` : `потрачено ${money(spent)}`, tone: 'muted' };
}

/**
 * A part of the savings (🔒, a fund's contribution, 💰) this month: all of it still goes — `done` ("✓ отложено");
 * the overspend took part — "выходит 3.98 ₾ — перерасход". Other months: none (what went is the summary's and the stats').
 */
export function savingsMark(plan: number, now: number, timing: Timing, done: string, money: Money, hidden: boolean): Mark | null {
  if (timing !== 'current' || plan <= 0) return null;
  if (now >= plan) return { text: done, tone: 'ok' };
  return { text: hidden ? 'меньше из-за перерасхода' : `выходит ${money(now)} — перерасход`, tone: 'warn' };
}

/** "Траты вне плана": spent of its share ("потрачено 120 ₾ из доли"), past it — "больше доли на 80 ₾". */
export function shareMark(share: number, spent: number, timing: Timing, money: Money, hidden: boolean): Mark | null {
  if (timing === 'future' || share <= 0) return null;
  if (spent > share) return { text: hidden ? 'больше доли' : `больше доли на ${money(spent - share)}`, tone: 'warn' };
  return { text: hidden ? `потрачено ${formatPercent(spent, share)} доли` : `потрачено ${money(spent)} из доли`, tone: 'muted' };
}
