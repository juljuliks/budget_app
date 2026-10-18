// "Итоги месяца": a month over is closed with answers, step by step — did the funds' contributions go in, what covers
// an overspend (spending past the budget less 🔒), where the leftover goes, was the saving put aside. What the answers
// send to the next month (an overspend owed, the leftover moved) is its carry. Answers are kept as given (a draft until
// closed); an unanswered question takes its default.
import { getDb } from '../index';
import { Currency } from '../fx';
import { currentYm, parseYm, ymOf } from './months';
import { planConverter, storedBudget } from './budget';
import { monthStats } from './stats';
import { activeFunds, fundLedger } from './funds';

export type OverCover = 'savings' | 'next' | 'covered';
export type OverRestCover = 'next' | 'covered';
export type RestChoice = 'savings' | 'next' | 'keep';
/** "Удалось отложить?": "Да, <сумма>" / "Другая сумма" / "Нет" */
export type SavedAnswer = 'yes' | 'other' | 'no';
export type CloseStep = 'funds' | 'over' | 'savings';

export type CloseAnswers = {
  over_cover: OverCover | null;
  /** what covers the overspend 🔒 couldn't */
  over_rest_cover: OverRestCover | null;
  rest_choice: RestChoice | null;
  saved: SavedAnswer | null;
  /** "Другая сумма" */
  saved_minor: number | null;
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
  /** the overspend 🔒 covers ("Из сбережений"), and what is left of it */
  from_savings_minor: number;
  over_rest_minor: number;
  /** 🔒 less what covered the overspend */
  kept_locked_minor: number;
  /** 🌊 "Что осталось": not spent, not 🔒 */
  rest_minor: number;
  /** "Удалось отложить?": 🔒 kept and the leftover going to savings; 0 — not asked */
  ask_minor: number;
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
  /** what was put aside ("Удалось отложить?"); null — not answered or not asked */
  saved_minor: number | null;
  /** every question answered: it can be closed */
  complete: boolean;
  /** what goes to the next month, in the budget's currency */
  carry: { debt_minor: number; plus_minor: number };
};

type CloseRow = CloseAnswers & { closed_at: number | null };

const nextOf = (ym: string) => { const { year, month } = parseYm(ym); return ymOf(year, month + 1); };

async function closeFunds(ym: string, nowYm: string): Promise<CloseFund[]> {
  const db = await getDb();
  const out: CloseFund[] = [];
  for (const fund of await activeFunds(ym)) {
    const planned = (await db.get<{ v: number }>(
      "SELECT limit_minor AS v FROM plan_items WHERE ym = ? AND category_id = ? AND kind = 'fund'", [ym, fund.category_id]))?.v ?? 0;
    if (planned <= 0) continue;
    const confirmed = (await db.get<{ v: number }>('SELECT saved_minor AS v FROM fund_confirms WHERE ym = ? AND category_id = ?', [ym, fund.category_id]))?.v;
    const m = (await fundLedger(fund, ym, nowYm)).months.find((x) => x.ym === ym);
    const c = await db.get<{ name: string; emoji: string | null }>('SELECT name, emoji FROM categories WHERE id = ?', [fund.category_id]);
    out.push({
      category_id: fund.category_id, name: c?.name ?? '', emoji: c?.emoji ?? null, currency: fund.currency,
      target_minor: fund.target_minor, due: fund.due, planned_minor: planned, confirmed_minor: confirmed ?? null,
      with_planned_minor: Math.max(0, (m?.end ?? 0) - (m?.contribution ?? 0) + planned),
    });
  }
  return out;
}

/** The leftover's choice of the last closed month: the default of the next one. */
async function lastRestChoice(ym: string): Promise<RestChoice | null> {
  const db = await getDb();
  return (await db.get<{ r: RestChoice }>(
    'SELECT rest_choice AS r FROM month_closes WHERE ym < ? AND closed_at IS NOT NULL AND rest_choice IS NOT NULL ORDER BY ym DESC LIMIT 1', [ym]))?.r ?? null;
}

/** The month's close: its steps, sums and answers. Asked of a month over (`ym` < `nowYm`). */
export async function monthClose(ym: string, nowYm = currentYm()): Promise<MonthClose> {
  const db = await getDb();
  const row = await db.get<CloseRow>('SELECT over_cover, over_rest_cover, rest_choice, saved, saved_minor, closed_at FROM month_closes WHERE ym = ?', [ym]);
  const next_ym = nextOf(ym);
  const can_carry = next_ym >= nowYm;
  const funds = await closeFunds(ym, nowYm);
  const stored = await storedBudget(ym);
  const last = row?.rest_choice ?? await lastRestChoice(ym);
  const answers: CloseAnswers = {
    over_cover: row?.over_cover ?? null,
    over_rest_cover: row?.over_rest_cover ?? (can_carry ? 'next' : 'covered'),
    rest_choice: last === 'next' && !can_carry && !row?.rest_choice ? 'savings' : last ?? 'savings',
    saved: row?.saved ?? null,
    saved_minor: row?.saved_minor ?? null,
  };
  let budget: CloseBudget | null = null;
  const carry = { debt_minor: 0, plus_minor: 0 };
  if (stored) {
    const cur = stored.currency;
    const conv = await planConverter(ym);
    const { year, month } = parseYm(ym);
    const stats = await monthStats(year, month, cur);
    const contributions = funds.reduce((a, f) => a + (conv(f.confirmed_minor ?? f.planned_minor, f.currency, cur) ?? 0), 0);
    const spent = stats.spent_minor + contributions;
    const amount = stored.amount_minor;
    const locked = stored.locked_minor;
    const over = Math.max(0, spent - (amount - locked));
    const rest = Math.max(0, amount - locked - spent);
    answers.over_cover ??= locked > 0 ? 'savings' : can_carry ? null : 'covered';
    const fromSavings = over > 0 && answers.over_cover === 'savings' ? Math.min(locked, over) : 0;
    const overRest = over > 0 && answers.over_cover === 'savings' ? over - fromSavings : 0;
    const kept = locked - fromSavings;
    const ask = kept + (rest > 0 && answers.rest_choice === 'savings' ? rest : 0);
    budget = {
      currency: cur, amount_minor: amount, locked_minor: locked, spent_minor: spent, over_minor: over,
      from_savings_minor: fromSavings, over_rest_minor: overRest, kept_locked_minor: kept, rest_minor: rest, ask_minor: ask,
    };
    if (over > 0) {
      carry.debt_minor = answers.over_cover === 'next' ? over : answers.over_rest_cover === 'next' ? overRest : 0;
    }
    if (answers.rest_choice === 'next') carry.plus_minor = rest;
  }
  const steps: CloseStep[] = [];
  if (funds.length) steps.push('funds');
  if (budget && budget.over_minor > 0) steps.push('over');
  if (budget && (budget.kept_locked_minor > 0 || budget.rest_minor > 0)) steps.push('savings');
  const ask = budget?.ask_minor ?? 0;
  const saved_minor = ask <= 0 || !answers.saved ? null
    : answers.saved === 'yes' ? ask : answers.saved === 'no' ? 0 : answers.saved_minor;
  const overAnswered = !budget || budget.over_minor === 0
    || (answers.over_cover !== null && (budget.over_rest_minor === 0 || answers.over_rest_cover !== null));
  const complete = funds.every((f) => f.confirmed_minor !== null) && overAnswered && (ask <= 0 || saved_minor !== null);
  return {
    ym, next_ym, can_carry, closed: row?.closed_at != null, steps, funds, budget, answers, saved_minor, complete, carry,
  };
}

/**
 * The oldest month over that isn't closed and has something to ask (a plan with a budget or a fund's contribution).
 * Every one with nothing to ask is closed on the way. null — nothing to close.
 */
export async function monthToClose(nowYm = currentYm()): Promise<string | null> {
  const db = await getDb();
  const open = await db.all<{ ym: string }>(
    `SELECT ym FROM (SELECT ym FROM plan_months WHERE budget_minor IS NOT NULL UNION SELECT ym FROM plan_items WHERE limit_minor > 0)
      WHERE ym < ? AND ym NOT IN (SELECT ym FROM month_closes WHERE closed_at IS NOT NULL) ORDER BY ym`, [nowYm]);
  let first: string | null = null;
  for (const { ym } of open) {
    if ((await monthClose(ym, nowYm)).steps.length) { first ??= ym; continue; }
    await db.run(
      `INSERT INTO month_closes (ym, closed_at) VALUES (?, ?) ON CONFLICT(ym) DO UPDATE SET closed_at = excluded.closed_at`,
      [ym, Math.floor(Date.now() / 1000)]);
  }
  return first;
}
