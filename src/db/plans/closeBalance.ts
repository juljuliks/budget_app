// "Остаток" of "Итоги месяца": the account at the month's end, in that month's budget currency. The month before's
// balance (its own budget currency, converted) plus what the budget would save is what the field opens on.
import { getDb } from '../index';
import { Currency } from '../fx';
import { parseYm, ymOf } from './months';
import { balanceView } from './closeSplit';

export type SavingsBalance = {
  /** this month is answered by the account, not by "Сколько удалось отложить?" */
  on: boolean;
  /** the month before's balance, in this month's budget currency; null — none stored */
  prior: number | null;
  /** "В августе было", typed when `prior` is null */
  open: number | null;
  /** the account at this month's end */
  value: number | null;
  suggested: number | null;
  /** this balance minus the base: what the month changed the account by */
  delta: number | null;
  /** suggested minus the balance: above 0 — short of the calculation */
  short: number | null;
};

type BalanceRow = { by_balance: number; balance_minor: number | null; balance_open_minor: number | null };

/** The month before's account balance, in `currency`. null — that month has none, or no rate to convert it. */
async function priorBalance(
  ym: string, currency: Currency, conv: (minor: number, from: string, to: string) => number | null,
): Promise<number | null> {
  const { year, month } = parseYm(ym);
  const row = await (await getDb()).get<{ minor: number; currency: string | null }>(
    `SELECT c.balance_minor AS minor, coalesce(p.budget_currency, c.carry_currency) AS currency
       FROM month_closes c LEFT JOIN plan_months p ON p.ym = c.ym
      WHERE c.ym = ? AND c.balance_minor IS NOT NULL`, [ymOf(year, month - 1)]);
  if (!row) return null;
  return conv(row.minor, row.currency ?? currency, currency);
}

/**
 * The balance answer of `ym`. `put` is the month's change when `on` (null until the base and the balance are both
 * known); null when the month is answered by "За месяц" — the caller keeps that answer.
 */
export async function savingsBalance(
  ym: string, currency: Currency, conv: (minor: number, from: string, to: string) => number | null,
  row: BalanceRow | null, ask: number,
): Promise<{ balance: SavingsBalance; put: number | null }> {
  const prior = await priorBalance(ym, currency, conv);
  const open = row?.balance_open_minor ?? null;
  const value = row?.balance_minor ?? null;
  const view = balanceView(prior, open, value, ask);
  const on = (row?.by_balance ?? 0) === 1;
  return {
    balance: { on, prior, open, value, suggested: view.suggested, delta: view.delta, short: view.short },
    put: on ? view.delta : null,
  };
}
