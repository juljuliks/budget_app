// A month's savings in "История": what went there (🔒 "Сразу" + 🌊 "Что осталось"), as the plan names them. While
// the month is on, the obligatory payments not paid yet aren't leftover: they still have to go.
import type { HistoryMonth } from '@/db/plans';

export type MonthSavings = {
  /** the month's line: "В сбережения" (the leftover goes there), "Сэкономлено" (it doesn't), "Перерасход" (over budget) */
  label: 'В сбережения' | 'Сэкономлено' | 'Перерасход';
  /** budget − spent (− the obligatory still to pay, while on); below 0: over the budget */
  total: number;
  /** the current month: "пока", the total comes at its end */
  pending: boolean;
  /** the section "Сбережения" of the opened month: the plan had 🔒 or the leftover going to savings */
  section: boolean;
  /** 🔒 locked at the start, and what's left of it (spending past the rest of the budget takes it) */
  locked: { plan: number; kept: number };
  /** 🌊 what the plan left (null: nothing), and what is left; over the budget — "Сверх бюджета", below 0 */
  rest: { label: 'Что осталось' | 'Сверх бюджета'; plan: number | null; value: number };
  /** the current month: the obligatory payments not paid yet, taken out of the leftover */
  unpaidFixed: number;
};

/** null: no budget that month — nothing to save from. */
export function monthSavings(m: HistoryMonth, current: boolean): MonthSavings | null {
  if (m.budget_minor === null) return null;
  const unpaidFixed = current ? m.unpaid_fixed_minor : 0;
  const total = m.budget_minor - m.spent_minor - unpaidFixed;
  const locked = m.locked_minor;
  const kept = Math.min(locked, Math.max(0, total));
  const planned = m.budget_minor - m.planned_minor - m.unplanned_minor - locked;
  return {
    label: total < 0 ? 'Перерасход' : m.to_savings ? 'В сбережения' : 'Сэкономлено',
    total,
    pending: current,
    section: locked > 0 || m.to_savings,
    locked: { plan: locked, kept },
    rest: { label: total < 0 ? 'Сверх бюджета' : 'Что осталось', plan: planned > 0 ? planned : null, value: total - kept },
    unpaidFixed,
  };
}
