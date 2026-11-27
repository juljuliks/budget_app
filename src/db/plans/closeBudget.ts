// The close's answers by default and its budget's side: the overspend, what covers it, the leftover, the payments moved.
import type { Currency } from '../fx';
import { parseYm } from './months';
import type { storedBudget } from './budget';
import { monthStats } from './stats';
import { coverOver } from './closeSplit';
import { type ClosePayment, closePayments, movedMinor } from './closePayments';
import type { CloseAnswers, CloseBudget, CloseFund, RestChoice } from './closeTypes';

export type CloseRow = CloseAnswers & { closed_at: number | null; locked_cover: number };

/** The answers as given; an unanswered one by its default (the leftover — as the last closed month's). */
export function closeAnswers(row: CloseRow | undefined, can_carry: boolean, last: RestChoice | null): CloseAnswers {
  return {
    over_cover: row?.over_cover ?? null,
    over_rest_cover: row?.over_rest_cover ?? (can_carry ? 'next' : 'covered'),
    // "Оставить как есть" is no longer asked: a month after one kept so goes to savings
    rest_choice:
      (last === 'next' && !can_carry && !row?.rest_choice) || (last === 'keep' && !row?.rest_choice)
        ? 'savings'
        : (last ?? 'savings'),
    saved: row?.saved ?? null,
    saved_minor: row?.saved_minor ?? null,
    by_balance: row?.by_balance ?? 0,
    balance_minor: row?.balance_minor ?? null,
    balance_open_minor: row?.balance_open_minor ?? null,
  };
}

type Side = {
  ym: string;
  row: CloseRow | undefined;
  stored: Awaited<ReturnType<typeof storedBudget>>;
  /** its over_cover default is set here (it depends on 🔒 and the funds) */
  answers: CloseAnswers;
  can_carry: boolean;
  currency: Currency;
  conv: (minor: number, from: string, to: string) => number | null;
  /** the funds, the nearest due first: their asked_minor is set here (less what the overspend takes) */
  order: CloseFund[];
  /** their contributions in `currency`, in that order: less what the overspend takes */
  amounts: number[];
  fundsPlanned: number;
};

/**
 * The budget's side of the close (a month with a budget): what was spent past it, what covers that ("Из сбережений":
 * 🔒, the funds, the savings from before), the leftover and the one-off payments moved on with their money.
 */
export async function budgetSide({
  ym,
  row,
  stored,
  answers,
  can_carry,
  currency,
  conv,
  order,
  amounts,
  fundsPlanned,
}: Side): Promise<{
  budget: CloseBudget | null;
  payments: ClosePayment[];
  moved: number;
  carry: { debt_minor: number; plus_minor: number };
}> {
  const carry = { debt_minor: 0, plus_minor: 0 };
  if (!stored) return { budget: null, payments: [], moved: 0, carry };
  const { year, month } = parseYm(ym);
  const stats = await monthStats(year, month, currency);
  const spent = stats.spent_minor + fundsPlanned;
  const amount = stored.amount_minor;
  const locked = stored.locked_minor;
  const over = Math.max(0, spent - (amount - locked));
  // the payments moved on take their money out of the leftover (as much as there is)
  const payments = can_carry ? await closePayments(ym, stats, conv, currency) : [];
  const moved = Math.min(movedMinor(payments), Math.max(0, amount - locked - spent));
  const rest = Math.max(0, amount - locked - spent) - moved;
  answers.over_cover ??= locked > 0 || fundsPlanned > 0 ? 'savings' : can_carry ? null : 'covered';
  const cover = coverOver(over, locked, amounts);
  const taken = over > 0 && answers.over_cover === 'savings';
  // closed before the funds and the savings from before covered it too: 🔒 alone, the rest as answered then
  const legacy = taken && row?.locked_cover === 1;
  const cut = taken && !legacy ? cover.funds : amounts.map(() => 0);
  cut.forEach((v, i) => {
    amounts[i] -= v;
  });
  for (const [i, f] of order.entries())
    f.asked_minor = Math.max(0, f.planned_minor - (conv(cut[i], currency, f.currency) ?? cut[i]));
  const budget: CloseBudget = {
    currency,
    amount_minor: amount,
    locked_minor: locked,
    spent_minor: spent,
    over_minor: over,
    cover: { locked: cover.locked, funds: cover.funds.reduce((a, v) => a + v, 0), past: cover.past },
    from_savings_minor: taken ? cover.locked : 0,
    from_funds_minor: cut.reduce((a, v) => a + v, 0),
    from_past_minor: taken && !legacy ? cover.past : 0,
    over_rest_minor: legacy ? over - cover.locked : 0,
    kept_locked_minor: locked - (taken ? cover.locked : 0),
    rest_minor: rest,
    own_spent_minor: stats.spent_minor,
  };
  if (over > 0) {
    carry.debt_minor =
      answers.over_cover === 'next' ? over : answers.over_rest_cover === 'next' ? budget.over_rest_minor : 0;
  }
  carry.plus_minor = (answers.rest_choice === 'next' ? rest : 0) + moved;
  return { budget, payments, moved, carry };
}
