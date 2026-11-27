// The close's shapes: its answers, what the budget's side and the funds come to, the whole month's close.
import type { Currency } from '../fx';
import type { SavingsBalance } from './closeBalance';
import type { ClosePayment } from './closePayments';

export type OverCover = 'savings' | 'next' | 'covered';
export type OverRestCover = 'next' | 'covered';
export type RestChoice = 'savings' | 'next' | 'keep';
/** "Сколько удалось отложить?": "Да, <сумма>" / "Другая сумма" / "Нет" */
type SavedAnswer = 'yes' | 'other' | 'no';
export type CloseStep = 'payments' | 'over' | 'savings';

export type CloseAnswers = {
  over_cover: OverCover | null;
  /** what covers the overspend 🔒 couldn't */
  over_rest_cover: OverRestCover | null;
  rest_choice: RestChoice | null;
  saved: SavedAnswer | null;
  /** "Другая сумма", or — "Остаток" — how much the account changed: all that was put aside */
  saved_minor: number | null;
  /** 1 — "Остаток" (the account), 0 — "За месяц" */
  by_balance: number;
  /** the account at the month's end, in the budget's currency; set only for "Остаток" */
  balance_minor: number | null;
  /** "В августе было", when the month before has no balance of its own */
  balance_open_minor: number | null;
};

/** What was put aside laid out, in the budget's currency (each fund's part in its own too). */
export type CloseSplit = {
  funds: Array<{ category_id: number; minor: number; budget_minor: number }>;
  locked: number;
  rest: number;
};

/** A fund asked about: its contribution that month, in its currency. */
export type CloseFund = {
  category_id: number;
  name: string;
  emoji: string | null;
  currency: Currency;
  target_minor: number;
  due: string;
  planned_minor: number;
  /** that less what the overspend took of it ("Из сбережений") */
  asked_minor: number;
  /** what went in; null — not answered */
  confirmed_minor: number | null;
  /** what it would have at the month's end with the planned contribution in */
  with_planned_minor: number;
};

/** The budget's side of the close, in the budget's currency. */
export type CloseBudget = {
  currency: Currency;
  amount_minor: number;
  locked_minor: number;
  /** the month's spending with the contributions that went in (unanswered: as planned) */
  spent_minor: number;
  /** spent past the budget less 🔒 */
  over_minor: number;
  /** what "Из сбережений" takes: 🔒, the funds' contributions (the farthest due first), the savings from before */
  cover: { locked: number; funds: number; past: number };
  /** what of it is taken (answered "Из сбережений"); a month closed before — 🔒 alone, the rest asked apart */
  from_savings_minor: number;
  from_funds_minor: number;
  from_past_minor: number;
  over_rest_minor: number;
  /** 🔒 less what covered the overspend */
  kept_locked_minor: number;
  /** 💰 "Сэкономлено": not spent, not 🔒, not the funds' */
  rest_minor: number;
  /** the month's spending without the funds' contributions: budget − it is what was left */
  own_spent_minor: number;
};

export type MonthClose = {
  ym: string;
  next_ym: string;
  /** the next month isn't over: an overspend or the leftover can go to it */
  can_carry: boolean;
  closed: boolean;
  steps: CloseStep[];
  funds: CloseFund[];
  budget: CloseBudget | null;
  /** as given, an unanswered one by its default */
  answers: CloseAnswers;
  /** what "Сколько удалось отложить?" asks, in `currency`: the funds' contributions, 🔒 kept and 💰 (unless it moves on) */
  ask_minor: number;
  currency: Currency;
  /** all that was put aside; null — not answered. "Остаток": how much the account changed, and it may be negative */
  put_minor: number | null;
  /** "Остаток": the account, in the budget's currency; what the month changes it by, as planned */
  balance: SavingsBalance;
  account_minor: number;
  /** it laid out (the funds' parts by hand, if changed), and as it would be by itself; null — not answered */
  split: CloseSplit | null;
  auto: CloseSplit | null;
  /** what is asked laid out ("Разложим так") */
  planned: CloseSplit;
  /** what of it went to savings (🔒 + 💰): what the history counts; null — not answered or not asked */
  saved_minor: number | null;
  /** every question answered: it can be closed */
  complete: boolean;
  /** what goes to the next month, in the budget's currency */
  carry: { debt_minor: number; plus_minor: number };
  /** the one-off payments not paid (only while the next month isn't over), what of them moves on with its money */
  payments: ClosePayment[];
  moved_minor: number;
};
