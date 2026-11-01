// A month's savings in "История": what went there (🔒 "Отложено сразу" + 💰 "Сэкономлено"), as the plan names them, and where
// its "Итоги месяца" sent the leftover. While the month is on, the obligatory payments not paid yet aren't leftover: they
// still have to go.
import type { HistoryMonth } from '@/db/plans';

export type MonthSavings = {
  /**
   * the month's line: "В сбережения" (the leftover goes there; so until its "Итоги" say otherwise), "Перенесено" (to the
   * next month), "Сэкономлено" (kept as is), "Перерасход бюджета" (over budget; "Перерасход плана" is the line above)
   */
  label: 'В сбережения' | 'Перенесено' | 'Сэкономлено' | 'Перерасход бюджета';
  /** what its "Итоги" said was put aside; null — not asked or not closed */
  saved: number | null;
  /** a month over whose "Итоги" aren't done: "Итоги не подведены" */
  open: boolean;
  /** budget − spent (− the obligatory still to pay, while on); below 0: over the budget */
  total: number;
  /**
   * the month's line's amount: what was put aside as its "Итоги" said (else the total); "Перенесено" — the leftover
   * moved (🔒 stays in savings)
   */
  value: number;
  /** the current month: "пока", the total comes at its end */
  pending: boolean;
  /** the section "Сбережения" of the opened month: the plan had 🔒 or the leftover going to savings */
  section: boolean;
  /** 🔒 locked at the start, and what's left of it (spending past the rest of the budget takes it) */
  locked: { plan: number; kept: number };
  /** 💰 what the plan left (null: nothing, under a unit, or over the budget), and what is left; over the budget — "Сверх бюджета", below 0 */
  rest: { label: 'Сэкономлено' | 'Сверх бюджета'; plan: number | null; value: number };
  /** the current month: the obligatory payments not paid yet, taken out of the leftover */
  unpaidFixed: number;
  /** funds deleted this month: what they had saved, in the total ("из копилки «Отпуск»") */
  released: HistoryMonth['released'];
};

/** What the plan left undistributed below this (in minor units: a unit) is the rates' and rounding's, not a plan. */
const MIN_PLANNED = 100;

/** null: no budget that month — nothing to save from. */
export function monthSavings(m: HistoryMonth, current: boolean): MonthSavings | null {
  if (m.budget_minor === null) return null;
  const unpaidFixed = current ? m.unpaid_fixed_minor : 0;
  // where the leftover went; null — not decided yet (it shows as going to savings)
  const rest = m.close?.closed ? m.close.rest_choice : null;
  const released = m.released.reduce((a, r) => a + r.minor, 0);
  const total = m.budget_minor - m.spent_minor - unpaidFixed + released;
  const locked = m.locked_minor;
  const kept = Math.min(locked, Math.max(0, total));
  const planned = m.budget_minor - m.planned_minor - m.unplanned_minor - locked;
  return {
    label: total < 0 ? 'Перерасход бюджета' : rest === 'next' ? 'Перенесено' : rest === 'keep' ? 'Сэкономлено' : 'В сбережения',
    saved: m.close?.closed ? m.close.saved_minor : null,
    open: !!m.close && !m.close.closed,
    total,
    value: total >= 0 && rest === 'next' ? total - kept - released : total >= 0 && m.close?.closed && m.close.saved_minor !== null ? m.close.saved_minor : total,
    pending: current,
    section: locked > 0 || rest === 'savings' || rest === null || released > 0,
    locked: { plan: locked, kept },
    // over the budget the plan has nothing for it; under a unit — the rate's dust, not a plan
    rest: { label: total < 0 ? 'Сверх бюджета' : 'Сэкономлено', plan: total >= 0 && planned >= MIN_PLANNED ? planned : null, value: total - kept - released },
    unpaidFixed,
    released: m.released,
  };
}
